import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '25mb' }));

  const createGeminiClient = () =>
    new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const extractGeminiErrorInfo = (error: unknown) => {
    const rawMsg =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const status =
      typeof (error as { status?: number })?.status === 'number'
        ? (error as { status?: number }).status
        : undefined;
    let parsedCode: number | undefined = status;
    let parsedStatus = '';
    let parsedMessage = rawMsg;

    try {
      const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          error?: { code?: number; message?: string; status?: string };
        };
        if (parsed?.error) {
          parsedCode = parsed.error.code ?? parsedCode;
          parsedStatus = parsed.error.status ?? '';
          parsedMessage = parsed.error.message ?? parsedMessage;
        }
      }
    } catch {
      // keep raw message
    }

    return {
      code: parsedCode,
      statusText: parsedStatus,
      message: parsedMessage,
    };
  };

  const isTransientGeminiError = (error: unknown) => {
    const { code, statusText, message } = extractGeminiErrorInfo(error);
    const lower = `${statusText} ${message}`.toLowerCase();
    return (
      code === 503 ||
      code === 429 ||
      code === 500 ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('resource_exhausted') ||
      lower.includes('temporarily') ||
      lower.includes('overloaded')
    );
  };

  const formatGeminiErrorAr = (error: unknown) => {
    const { code, statusText, message } = extractGeminiErrorInfo(error);
    const lower = `${statusText} ${message}`.toLowerCase();
    if (!process.env.GEMINI_API_KEY) {
      return 'مفتاح خدمة Gemini غير مضبوط في إعدادات الخادم (Secrets).';
    }
    if (
      code === 403 ||
      code === 401 ||
      lower.includes('permission_denied') ||
      lower.includes('api_key_invalid')
    ) {
      return 'تعذر التحقق من صلاحية مفتاح Gemini API — يرجى مراجعة المفتاح في Settings > Secrets.';
    }
    if (code === 429 || lower.includes('resource_exhausted')) {
      return 'تم الوصول للحد الأقصى المؤقت لطلبات الذكاء الاصطناعي، يرجى الانتظار بضع ثوانٍ والمحاولة مجدداً.';
    }
    if (
      code === 503 ||
      lower.includes('unavailable') ||
      lower.includes('high demand')
    ) {
      return 'خدمة Gemini تشهد ضغطاً مرتفعاً مؤقتاً الآن، اضغط «إعادة المحاولة» بعد لحظات.';
    }
    return 'تعذر إتمام الاتصال بخدمة الذكاء الاصطناعي حالياً، يرجى المحاولة مرة أخرى.';
  };

  async function runModelsWithBackoff(
    models: string[],
    invoke: (ai: GoogleGenAI, model: string) => Promise<string | undefined>
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('MISSING_API_KEY');
    }
    const ai = createGeminiClient();
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const text = await invoke(ai, model);
          if (text && text.trim()) {
            return text.trim();
          }
          throw new Error('EMPTY_RESPONSE');
        } catch (err) {
          lastError = err;
          if (!isTransientGeminiError(err)) {
            throw err;
          }
          if (attempt === 0) {
            await sleep(500);
          }
        }
      }
    }

    throw lastError;
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/gemini', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة نص السؤال أولاً.' });
      }
      const text = await runModelsWithBackoff(
        ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
        async (ai, model) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt.trim(),
            config: {
              systemInstruction:
                'أنت مساعد ذكي متخصص في الإدارة العامة للبيئة والسلامة المهنية وصياغة المذكرات الرسمية وتحليل التقارير البيئية لشركة الدقهلية لصناعة وتكرير السكر.',
            },
          });
          return response.text;
        }
      );
      res.json({ text });
    } catch (error: unknown) {
      console.error('Gemini API error:', error);
      const { code } = extractGeminiErrorInfo(error);
      res.status(code && code >= 400 && code < 600 ? code : 500).json({
        error: formatGeminiErrorAr(error),
      });
    }
  });

  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, fileName } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        fileName?: string;
      };
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'بيانات الصوت مطلوبة للتفريغ.' });
      }
      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const rawMime = (mimeType || '').split(';')[0].trim().toLowerCase();
      const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

      const mimeAliasMap: Record<string, string> = {
        'audio/mp3': 'audio/mpeg',
        'audio/x-mpeg': 'audio/mpeg',
        'audio/x-wav': 'audio/wav',
        'audio/wave': 'audio/wav',
        'audio/x-m4a': 'audio/mp4',
        'audio/m4a': 'audio/mp4',
        'video/mp4': 'audio/mp4',
        'video/webm': 'audio/webm',
      };
      const extMimeMap: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        mp4: 'audio/mp4',
        aac: 'audio/aac',
        ogg: 'audio/ogg',
        opus: 'audio/ogg',
        flac: 'audio/flac',
        webm: 'audio/webm',
      };

      const mappedMime = mimeAliasMap[rawMime] || rawMime;
      const validMime = mappedMime.startsWith('audio/')
        ? mappedMime
        : extMimeMap[ext] || 'audio/webm';

      const text = await runModelsWithBackoff(
        ['gemini-3.5-transcribe'],
        async (ai, model) => {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: validMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: 'فرّغ الكلام المنطوق في هذا التسجيل الصوتي باللغة العربية بدقة في نص مباشر بدون أي مقدمات أو تعليقات.',
                },
              ],
            },
          });
          return response.text;
        }
      );
      res.json({ text });
    } catch (error: unknown) {
      console.error('Audio transcription error:', error);
      const { code } = extractGeminiErrorInfo(error);
      res.status(code && code >= 400 && code < 600 ? code : 500).json({
        error: formatGeminiErrorAr(error),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

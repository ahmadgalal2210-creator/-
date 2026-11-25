import { Image as ImageIcon, Plus, Upload } from 'lucide-react';
import { saveLocalBlob } from '../../lib/blobStore';
import {
  cleanFileTitle,
  formatBytes,
  makeSafeId,
  processImageFile,
} from '../../lib/fileParser';
import type { IndexedImage, InspectedItem, ProjectFolder } from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';

interface ImagesViewProps {
  images: IndexedImage[];
  projects: ProjectFolder[];
  defaultProjectId?: string;
  onAddImageModal: () => void;
  onCreateImage: (img: IndexedImage) => Promise<void>;
  onDeleteImage: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onToast: (msg: string) => void;
}

export function ImagesView({
  images,
  projects,
  defaultProjectId = '',
  onAddImageModal,
  onCreateImage,
  onDeleteImage,
  onInspect,
  onToast,
}: ImagesViewProps) {
  const handleQuickImages = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    for (const file of Array.from(list)) {
      const imgMeta = await processImageFile(file);
      const id = makeSafeId('img');
      await saveLocalBlob(id, file);
      await onCreateImage({
        id,
        title: cleanFileTitle(file.name),
        fileName: file.name,
        domain: 'company',
        projectId: defaultProjectId,
        sizeBytes: file.size,
        capturedAt: new Date().toISOString().slice(0, 10),
        caption: imgMeta.summaryText,
        hasBlob: true,
        thumbnailDataUrl: imgMeta.thumbnailDataUrl,
        dataUrl: imgMeta.thumbnailDataUrl,
        width: imgMeta.width,
        height: imgMeta.height,
      });
      onToast(`تمت إضافة الصورة «${file.name}»`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
            أرشيف الصور والتوثيق الميداني ({images.length})
          </h3>
          <p className="text-xs text-slate-500">
            صور محطات المعالجة، العينات، ولوحات المتابعة اليومية
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>رفع صور سريعة</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleQuickImages(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            onClick={onAddImageModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة صورة</span>
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد صور محفوظة حالياً
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img) => {
            const folderName = projects.find((p) => p.id === img.projectId)?.name;
            return (
              <div
                key={img.id}
                onClick={() => onInspect({ kind: 'image', id: img.id })}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div className="h-44 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                  {img.thumbnailDataUrl ? (
                    <img
                      src={img.thumbnailDataUrl}
                      alt={img.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-display text-xs font-extrabold text-slate-950 dark:text-white truncate">
                        {img.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {formatBytes(img.sizeBytes)} · {img.capturedAt}
                        {folderName ? ` · ${folderName}` : ''}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ConfirmDeleteInline compact onConfirm={() => onDeleteImage(img.id)} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { WorkspaceState } from '../types';

export function createSampleWorkspaceSeed(): WorkspaceState {
  const now = new Date().toISOString();
  return {
    projects: [
      {
        id: 'proj_sugar_env',
        name: 'ملف البيئة الرئيسي — مصنع السكر',
        domain: 'company',
        code: 'ENV-2026',
        description:
          'متابعة قياسات الصرف الصناعي والصحي، تقارير جهاز شؤون البيئة، وأبحاث د. أيمن عبد الحميد.',
        createdAt: now,
      },
      {
        id: 'proj_safety_osh',
        name: 'السلامة المهنية والأمن الصناعي',
        domain: 'company',
        code: 'OSH-2026',
        description:
          'خطط الطوارئ، تفتيش الحماية المدنية، ومهمات الوقاية الشخصية بالمصنع.',
        createdAt: now,
      },
    ],
    correspondenceEntities: [
      {
        id: 'ent_ministry_env',
        name: 'وزارة البيئة',
        category: 'جهة رقابية حكومية',
        contactInfo: 'جهاز شؤون البيئة — فرع الدقهلية',
        notes: 'مخاطبات السجل البيئي، موافقات الصرف الصناعي، والانبعاثات.',
        createdAt: now,
      },
      {
        id: 'ent_health_dir',
        name: 'مديرية الصحة',
        category: 'جهة صحية ورقابية',
        contactInfo: 'إدارة الصحة المهنية والبيئة بالدقهلية',
        notes: 'متابعة عينات المياه والصرف الصحي وشهادات الصلاحية المهنية.',
        createdAt: now,
      },
    ],
    correspondences: [
      {
        id: 'corr_sample_1',
        entityId: 'ent_ministry_env',
        entityName: 'وزارة البيئة',
        direction: 'incoming',
        refNumber: 'ENV-IN-412',
        subject: 'خطاب متابعة نتائج تحاليل مخرج الصرف الصناعي الربع سنوية',
        body: 'السيد الأستاذ الدكتور / أيمن عبد الحميد — مدير عام البيئة والسلامة المهنية\nتحية طيبة وبعد،،،\nيرجى موافاتنا بنتائج تحاليل عينات الصرف الصناعي للربع الحالي (COD / BOD / TSS) ومطابقتها للمعايير القانونية.',
        date: now.slice(0, 10),
        subDepartment: 'إدارة الصرف الصناعي',
        linkedFileIds: ['file_cod_sheet'],
        pinned: true,
        updatedAt: now,
      },
      {
        id: 'corr_sample_2',
        entityId: 'ent_ministry_env',
        entityName: 'وزارة البيئة',
        direction: 'outgoing',
        refNumber: 'DSR-OUT-108',
        subject: 'رد على: نتائج تحاليل مخرج الصرف الصناعي واعتماد القراءات',
        body: 'مرفق لسيادتكم نتائج التحاليل المعملية المعتمدة لمحطة معالجة الصرف الصناعي بشركة الدقهلية لصناعة وتكرير السكر، وجميع القياسات مطابقة لحدود القانون رقم 4 لسنة 1994.',
        date: now.slice(0, 10),
        subDepartment: 'إدارة الصرف الصناعي',
        linkedFileIds: ['file_cod_sheet'],
        pinned: false,
        replyToId: 'corr_sample_1',
        threadId: 'corr_sample_1',
        updatedAt: now,
      },
    ],
    files: [
      {
        id: 'file_phd_ayman',
        title: 'رسالة الدكتوراه في الكيمياء والسلامة المهنية — د. أيمن عبد الحميد',
        fileName: 'PhD_Thesis_Ayman_AbdelHamid_Chemistry_OSH.docx',
        category: 'word',
        domain: 'company',
        projectId: 'proj_sugar_env',
        researchKind: 'phd',
        headings: [
          'الفصل الأول: مقدمة في الكيمياء التطبيقية والسلامة المهنية',
          'الفصل الثاني: معالجة المخلفات السائلة في مصانع السكر',
          'الفصل الثالث: تقييم المخاطر الكيميائية في خطوط الإنتاج',
          'الفصل الرابع: النتائج والتوصيات البيئية',
        ],
        sizeBytes: 2450000,
        notes: 'رسالة الدكتوراه في الكيمياء والسلامة المهنية — إعداد د. أيمن عبد الحميد.',
        hasBlob: false,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText:
          'رسالة الدكتوراه في الكيمياء والسلامة المهنية\nإعداد: د. أيمن عبد الحميد\n\nالفصل الأول: مقدمة في الكيمياء التطبيقية والسلامة المهنية\nدراسة شاملة لتطبيقات الكيمياء الصناعية ومعايير السلامة المهنية داخل منشآت تكرير السكر.\n\nالفصل الثاني: معالجة المخلفات السائلة في مصانع السكر\nتحليل كفاءة وحدات التهوية البيولوجية وخفض الأحمال العضوية COD و BOD.\n\nالفصل الرابع: النتائج والتوصيات البيئية\nتوصيات تطبيقية لتحسين الأداء البيئي وحماية العاملين.',
        starred: true,
        updatedAt: now,
      },
      {
        id: 'file_cod_sheet',
        title: 'سجل قياسات محطة الصرف الصناعي (COD / BOD / pH)',
        fileName: 'Industrial_Drainage_Measurements_2026.xlsx',
        category: 'excel',
        domain: 'company',
        projectId: 'proj_sugar_env',
        researchKind: 'none',
        headings: ['ورقة: قياسات المحطة', 'ورقة: حدود المطابقة'],
        sizeBytes: 184000,
        notes: 'جدول المتابعة اليومية لمخرج محطة المعالجة الصناعية.',
        hasBlob: false,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extractedText:
          '[قياسات المحطة]\nالتاريخ | pH | COD | BOD | TSS\n2026-11-01 | 7.2 | 185 | 42 | 28\n2026-11-10 | 7.1 | 172 | 39 | 24',
        sheetPreview: [
          {
            sheetName: 'قياسات المحطة',
            headers: ['التاريخ', 'pH', 'COD (mg/L)', 'BOD (mg/L)', 'TSS (mg/L)', 'الحالة'],
            rows: [
              ['2026-11-01', '7.2', '185', '42', '28', 'مطابق'],
              ['2026-11-10', '7.1', '172', '39', '24', 'مطابق'],
              ['2026-11-18', '7.3', '168', '36', '22', 'مطابق'],
            ],
          },
          {
            sheetName: 'حدود المطابقة',
            headers: ['المعامل', 'الحد الأقصى المسموح', 'الوحدة'],
            rows: [
              ['pH', '6.0 - 9.0', '-'],
              ['COD', '700', 'mg/L'],
              ['BOD', '400', 'mg/L'],
            ],
          },
        ],
        starred: true,
        updatedAt: now,
      },
    ],
    images: [],
    memos: [
      {
        id: 'memo_in_1',
        title: 'تقرير فحص أجهزة الإطفاء والإنذار بالعنابر',
        content:
          'ملخص التقرير الوارد من إدارة الأمن الصناعي:\nتمت مراجعة جميع طفايات الحريق وشبكة الإطفاء الآلي بعنبر التكرير والتعبئة، والتأكد من صلاحية الضغوط.',
        domain: 'company',
        projectId: 'proj_safety_osh',
        pinned: true,
        direction: 'incoming',
        departmentName: 'إدارة الأمن الصناعي',
        linkedFileIds: [],
        updatedAt: now,
      },
      {
        id: 'memo_out_1',
        title: 'اعتماد خطة المعايرة الشهرية لمحطة الصرف الصناعي',
        content:
          'تحية طيبة وبعد،،،\nتقرر بدء أعمال المعايرة الدورية لحساسات الأكسجين المذاب والأس الهيدروجيني بمحطة الصرف الصناعي اعتباراً من الأسبوع الجاري وتحت إشراف د. أيمن عبد الحميد.',
        domain: 'company',
        projectId: 'proj_sugar_env',
        pinned: false,
        direction: 'outgoing',
        departmentName: 'إدارة الصرف الصناعي',
        linkedFileIds: ['file_cod_sheet'],
        updatedAt: now,
      },
    ],
    drafts: [
      {
        id: 'draft_factory_1',
        title: 'مسودة خطة السلامة المهنية لموسم البنجر',
        content:
          'بنود خطة التأمين لموسم التشغيل:\n1. مراجعة مهمات الوقاية للعاملين بالمعمل الكيميائي.\n2. تجهيز نقاط غسل العيون في قسم الكيماويات.\n3. تدريب فرق الطوارئ على سيناريوهات الإخلاء.',
        scope: 'factory',
        projectId: 'proj_safety_osh',
        pinned: true,
        updatedAt: now,
      },
      {
        id: 'draft_private_1',
        title: 'ملاحظات بحثية خاصة — د. أيمن عبد الحميد',
        content:
          'نقاط للمراجعة في الورقة البحثية الجديدة حول كفاءة المعالجة الكيميائية الحيوية بمصانع تكرير السكر.',
        scope: 'private',
        projectId: 'proj_sugar_env',
        pinned: false,
        updatedAt: now,
      },
    ],
    orders: [
      {
        id: 'order_sample_1',
        refCode: 'BM-2026-101',
        title: 'تطهير وصيانة أحواض الترسيب بمحطة الصرف الصناعي',
        details:
          'تنفيذ أعمال التطهير الدورية وقياس كفاءة السحب في حوض الترسيب رقم 2 وتوثيق القراءات.',
        domain: 'company',
        projectId: 'proj_sugar_env',
        issuer: 'د. أيمن عبد الحميد',
        assigneeOrUnit: 'إدارة الصرف الصناعي',
        subDepartment: 'إدارة الصرف الصناعي',
        technicians: ['م. محمد السعيد', 'فني/ حسن إبراهيم'],
        isAssigned: true,
        priority: 'high',
        status: 'in_progress',
        dueDate: now.slice(0, 10),
        linkedFileIds: ['file_cod_sheet'],
        sourceMessageId: '',
        createdAt: now,
      },
    ],
    messages: [],
  };
}

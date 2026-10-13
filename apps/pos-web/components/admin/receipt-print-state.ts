export type ReceiptPrintJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "PRINTED"
  | "SUBMITTED"
  | "DEAD_LETTER"
  | "CANCELLED";

type ReceiptPrintSummary = {
  label: string;
  note?: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
};

export function receiptPrintState(receipt: {
  printed: boolean;
  printJobs?: readonly {
    status: ReceiptPrintJobStatus;
    createdAt?: string | Date;
  }[] | null;
}): ReceiptPrintSummary {
  const allJobs = receipt.printJobs ?? [];
  const jobTimes = allJobs.map((job) =>
    job.createdAt instanceof Date
      ? job.createdAt.getTime()
      : Date.parse(job.createdAt ?? ""),
  );
  const latestJobTime = Math.max(...jobTimes);
  const jobs =
    allJobs.length > 0 && jobTimes.every(Number.isFinite)
      ? allJobs.filter((_, index) => jobTimes[index] === latestJobTime)
      : allJobs;
  const hasActiveJob = jobs.some(
    (job) => job.status === "PENDING" || job.status === "PROCESSING",
  );
  const hasFailedJob = jobs.some((job) => job.status === "DEAD_LETTER");

  if (hasFailedJob) {
    const hasOtherJob = jobs.some(
      (job) => job.status !== "DEAD_LETTER" && job.status !== "CANCELLED",
    );
    return {
      label: hasOtherJob ? "Ayrim printerlarda xato" : "Chopda xato",
      note: "Chop navbatida xato bilan to‘xtagan ishni tekshiring",
      tone: "danger",
    };
  }
  if (hasActiveJob) {
    return { label: "Printer navbatida", tone: "info" };
  }
  if (jobs.some((job) => job.status === "SUBMITTED")) {
    return {
      label: "Drayver qabul qildi",
      note: "Qog‘ozni tekshiring",
      tone: "warning",
    };
  }
  if (jobs.some((job) => job.status === "PRINTED")) {
    return {
      label: "Eski holat",
      note: "Qog‘oz tasdiqlanmagan",
      tone: "warning",
    };
  }
  if (jobs.some((job) => job.status === "CANCELLED")) {
    return { label: "Chop bekor qilingan", tone: "neutral" };
  }
  if (receipt.printed) {
    return { label: "Qo‘lda belgilangan", tone: "neutral" };
  }
  return { label: "Tasdiq yo‘q", tone: "neutral" };
}

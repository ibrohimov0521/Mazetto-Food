"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "./api";

/*
 * Admin ekranlari uchun ma'lumot yuklash.
 *
 * MUAMMO. 22 ta admin komponenti bir xil bloknni takrorlardi: `isLoading`
 * qo'yish, `try/catch`, `SessionExpiredError` ni jimgina yutish, xato
 * matnini o'rnatish. Jami 43 ta bir xil `catch`.
 *
 * ASOSIY XATO esa boshqasi edi: ularning HECH BIRIDA javob tartibi
 * qo'riqchisi yo'q edi. Kamida oltita ekran filtr o'zgarganda qayta
 * yuklaydi (`[branchId, offset, status]`), ya'ni filtrni tez ikki marta
 * almashtirganda ikkita so'rov yo'lda bo'ladi va SEKINROG'I oxirgi
 * bo'lib keladi. Natijada jadval oldingi filtr ma'lumotini ko'rsatib
 * turadi, boshqaruvlar esa yangisini — foydalanuvchi noto'g'ri
 * ma'lumotni to'g'ri deb o'qiydi.
 *
 * Bu hook har so'rovga NAVBAT RAQAMI beradi va faqat oxirgisining
 * natijasini qabul qiladi.
 *
 * NIMA UCHUN react-query EMAS. U ham shu muammoni yechadi, lekin yangi
 * bog'liqlik va 22 faylni qayta yozishni talab qiladi. Bu yerda kerak
 * bo'lgani — navbat raqami va bitta `catch`; kesh va qayta urinish
 * admin panelida talab qilinmagan.
 */

export type ApiResource<T> = {
  data: T | null;
  isLoading: boolean;
  /** Bo'sh satr — xato yo'q. */
  error: string;
  reload: () => void;
};

export function useApiResource<T>(
  load: () => Promise<T>,
  /*
   * Bog'liqliklar — filtr qiymatlari. Ular o'zgarganda qayta yuklanadi.
   * `load` ning O'ZI bog'liqlik emas: u har chizishda yangi funksiya
   * bo'ladi va cheksiz tsikl yaratardi.
   */
  deps: readonly unknown[],
  errorMessage: string,
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const version = ++request.current;
    setIsLoading(true);
    setError("");

    void (async () => {
      try {
        const next = await loadRef.current();
        // Eskirgan javob TASHLANADI — yangisi allaqachon yo'lda.
        if (version !== request.current) return;
        setData(next);
      } catch (caught) {
        if (version !== request.current) return;
        /*
         * `SessionExpiredError` jimgina yutiladi: sessiya provayderi
         * allaqachon login sahifasiga o'tkazyapti va bu yerda xato
         * ko'rsatish foydalanuvchiga chalkash xabar berardi.
         */
        if (caught instanceof SessionExpiredError) return;
        setError(caught instanceof Error ? caught.message : errorMessage);
      } finally {
        if (version === request.current) setIsLoading(false);
      }
    })();

    return () => {
      /*
       * Komponent yopilganda navbat raqamini surib qo'yamiz — yo'ldagi
       * javob yopilgan komponentga yozishga urinmasin.
       */
      request.current += 1;
    };
    /*
     * `loadRef` orqali chaqirilgani uchun `load` bog'liqlikda emas —
     * u har chizishda yangi funksiya bo'lib, cheksiz tsikl yaratardi.
     * Qayta yuklashni CHAQIRUVCHI `deps` bilan boshqaradi.
     */
  }, [...deps, attempt, errorMessage]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { data, isLoading, error, reload };
}

/** Bitta endpoint uchun qisqartma. */
export function useApiList<T>(
  path: string,
  errorMessage: string,
  deps: readonly unknown[] = [],
): ApiResource<T> {
  return useApiResource<T>(
    () => apiFetch<T>(path),
    [path, ...deps],
    errorMessage,
  );
}

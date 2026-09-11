"use client";

import Link from "next/link";
import { Phone, UserRound, ReceiptText } from "lucide-react";
import { useCart } from "../lib/cart";
import styles from "./contact-footer.module.css";
import {
  isSupportPhoneValid,
  supportLinks,
  supportPhone,
} from "../lib/contact";

export function ContactFooter({ showProfile = false }: { showProfile?: boolean }) {
  const { customer } = useCart();
  return (
    <footer className={styles.footer} role="contentinfo" aria-label="Mazetto Food aloqa">
      <div className={styles.row}>
        <div className={styles.contacts}>
          <p className={styles.heading}>Biz bilan bog'laning</p>
          <div className={styles.links}>
            <a className={styles.link} href={supportLinks.instagram} target="_blank" rel="noopener noreferrer">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg><span>Instagram</span>
            </a>
            <a className={styles.link} href={supportLinks.telegram} target="_blank" rel="noopener noreferrer">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 3.6 18.2 20c-.2 1.2-.9 1.5-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.8 13.8 1 12.3c-1-.3-1.1-1 .2-1.5L20 3.5c.9-.3 1.7.2 1.4.1Z" /></svg><span>Telegram</span>
            </a>
            {/*
              Raqam yaroqsiz bo'lsa (hozir shunday: +998 dan keyin 8
              raqam) `tel:` havolasi berilmaydi — bosiladigan, lekin
              hech qayerga ulanmaydigan havola ko'rsatishdan ko'ra
              matn sifatida ko'rsatish to'g'riroq.
            */}
            {isSupportPhoneValid ? (
              <a className={styles.link} href={`tel:${supportPhone.href}`}>
                <Phone aria-hidden="true" size={17} /><span>{supportPhone.display}</span>
              </a>
            ) : (
              <span className={styles.link}>
                <Phone aria-hidden="true" size={17} /><span>{supportPhone.display}</span>
              </span>
            )}
          </div>
        </div>
        {showProfile ? (
          <div className={styles.profile}>
            <UserRound className={styles.userIcon} aria-hidden="true" size={20} />
            <div className={styles.identity}>
              <p className={styles.heading}>{customer?.accessToken ? "Profil ulangan" : "Mening profilim"}</p>
              {customer?.accessToken ? <p className={styles.details}>{customer.name}<span>{customer.phone}</span></p> : null}
            </div>
            <Link className={styles.link} href={customer?.accessToken ? "/orders" : "/profile"}>
              <ReceiptText aria-hidden="true" size={17} />
              <span>{customer?.accessToken ? "Buyurtmalarim" : "Kirish"}</span>
            </Link>
          </div>
        ) : null}
      </div>
      <div className={styles.creditRow}>
        <a className={styles.credit} href="https://t.me/BESTteamuzbot" target="_blank" rel="noopener noreferrer" aria-label="Created by BT, Telegram bot">
          <img src="/brand/bt-mark-v1.webp" alt="BT" width={24} height={24} loading="lazy" decoding="async" />
          <span>created by BT</span>
        </a>
      </div>
    </footer>
  );
}

import Link from "next/link";
import Image from "next/image";
import type { MouseEvent } from "react";
import "./brand.css";

export function BrandLogo({
  light = false,
  mark = false,
  width = 190,
}: {
  light?: boolean;
  mark?: boolean;
  width?: number;
}) {
  return (
    <Image
      className={mark ? "edubest-brand-symbol" : "edubest-brand-logo"}
      src={`/brand/edubest-${mark ? "mark" : "logo"}${light ? "-light" : ""}.png?v=3`}
      width={width}
      height={mark ? width : Math.round(width / 5)}
      alt="EduBest"
      unoptimized
    />
  );
}

export default function SchoolBrand({
  subtitle,
  light = false,
  href = "/",
  onClick,
}: {
  subtitle?: string;
  light?: boolean;
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="brand edubest-brand"
      aria-label={
        href.startsWith("/app")
          ? "EduBest — tableau de bord"
          : "EduBest — accueil"
      }
    >
      <BrandLogo light={light} />
      {subtitle && <span className="school-wordmark">{subtitle}</span>}
    </Link>
  );
}

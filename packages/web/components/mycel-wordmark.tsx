import Link from "next/link";

type Props = {
  href?: string;
  /** If false, render text only (e.g. login card). */
  asLink?: boolean;
};

export function MycelWordmark({
  href = "/dashboard",
  asLink = true,
}: Props) {
  const text = (
    <span className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
      mycel
    </span>
  );
  if (!asLink) {
    return text;
  }
  return <Link href={href}>{text}</Link>;
}

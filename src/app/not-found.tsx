import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
      <p className="font-mono text-sm uppercase tracking-wider text-foreground-subtle">404</p>
      <h1 className="text-lg font-semibold">ページが見つかりません</h1>
      <p className="max-w-md text-center text-sm text-foreground-muted">
        お探しのページは移動・削除されたか、URLが正しくない可能性があります。
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg transition-opacity hover:opacity-90"
      >
        ダッシュボードに戻る
      </Link>
    </div>
  );
}

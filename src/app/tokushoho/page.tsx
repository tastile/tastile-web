import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "特定商取引法に基づく表記 — Tastile",
  description:
    "特定商取引に関する法律第11条に基づき、以下のとおり表記致します。",
};

export default function TokushohoPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">
            特定商取引法に基づく表記
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">
              「特定商取引に関する法律」第11条に基づき、以下のとおり表記致します。
            </p>

            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    販売事業者
                  </th>
                  <td className="py-3 text-foreground-muted">
                    木村 友亮（きむら ゆうすけ）
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    運営統括責任者
                  </th>
                  <td className="py-3 text-foreground-muted">
                    木村 友亮
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    所在地
                  </th>
                  <td className="py-3 text-foreground-muted">
                    請求があった場合には速やかに開示いたします。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    電話番号
                  </th>
                  <td className="py-3 text-foreground-muted">
                    請求があった場合には速やかに開示いたします。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    メールアドレス
                  </th>
                  <td className="py-3 text-foreground-muted">
                    support@tastile.app
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    販売価格
                  </th>
                  <td className="py-3 text-foreground-muted">
                    各プランページに記載の金額（消費税込）
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    商品代金以外の必要料金
                  </th>
                  <td className="py-3 text-foreground-muted">
                    なし
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    支払い方法
                  </th>
                  <td className="py-3 text-foreground-muted">
                    クレジットカード、Apple Pay、Google Pay
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    支払い時期
                  </th>
                  <td className="py-3 text-foreground-muted">
                    クレジットカード決済はただちに処理されます。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    サービスの提供時期
                  </th>
                  <td className="py-3 text-foreground-muted">
                    お支払い確認後、すぐにサービスをご利用いただけます。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    返品・返金に関する事項
                  </th>
                  <td className="py-3 text-foreground-muted">
                    デジタルコンテンツの性質上、お客様都合による返品・返金はお受けしておりません。
                    サービスに技術的な問題がある場合は、support@tastile.app
                    までお問い合わせください。確認のうえ、対応いたします。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    申込期間
                  </th>
                  <td className="py-3 text-foreground-muted">
                    特に制限はございません。継続的にサービスをご利用いただけます。
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    動作環境
                  </th>
                  <td className="py-3 text-foreground-muted">
                    インターネット接続が必要です。推奨ブラウザ: Google Chrome、Safari、Firefox、Microsoft
                    Edge。モバイル: 最新版の iOS / Android。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

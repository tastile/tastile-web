import {
  marketingEn,
  marketingJa,
  marketingLandingEn,
  marketingLandingJa,
} from "./translations-marketing";
import { quickCreateEn, quickCreateJa } from "./translations-quick-create";

export const translations = {
  ja: {
    // Navigation
    nav: {
      execute: "実行",
      integrations: "連携",
      settings: "設定",
      new: "新規",
      timeline: "タイムライン",
      tasks: "タスク",
      projects: "プロジェクト",
      schedule: "スケジュール",
      preferences: "設定",
    },

    // Shell chrome (activity bar, floating header, etc.)
    shell: {
      activityBar: {
        ariaLabel: "アクティビティバー",
        sidebarControl: "サイドバー操作",
        sidebar: "サイドバー",
        expanded: "常に展開",
        collapsed: "常に折りたたむ",
        expandOnHover: "ホバーで展開",
      },
      floatingHeader: {
        homeAria: "tastile ホーム",
        executing: "実行中",
        idle: "待機中",
        left: "残り",
        openSearch: "検索を開く",
        openNotifications: "通知を開く",
        userMenu: "ユーザーメニュー",
        openNavMenu: "ナビゲーションメニューを開く",
        statusLabel: "ステータス",
        statusExecuting: "実行中",
        statusIdle: "待機",
        accountSettings: "アカウント設定",
        logOut: "ログアウト",
        menu: "メニュー",
        search: "検索",
        notifications: "通知",
      },
    },

    // Notifications (browser/system messages)
    notifications: {
      promptPending: "確認が必要な通知があります",
      onBreak: "休憩フェーズが実行中です",
      running: "実行中",
      accessShareOffer: "共有オファーがあります",
      accessRequest: "アクセスリクエストがあります",
      accessUpdated: "アクセス権が更新されました",
      accessOther: "アクセス通知があります",
      generic: "通知があります",
    },

    // Header
    header: {
      active: "実行中",
      menu: "メニュー",
      notifications: "通知",
      sync: {
        in_progress: "同期中",
        error: "同期エラー",
        delta: "同期",
        idle: "同期待機",
      },
    },

    // Language toggle
    languageToggle: {
      switchToEnglish: "Switch to English",
      switchToJapanese: "日本語に切替",
    },

    // Execution bar
    execution: {
      runningLabel: "実行中",
      breakLabel: "休憩中",
      notStartedLabel: "未実行",
      remainingLabel: "残り",
      prompt: {
        startTile: "タスクを開始",
        endTile: "タスクを終了",
        endBreak: "休憩終了",
        defer30: "30分",
        defer1h: "1時間",
        defer2h: "2時間",
        deferTomorrow: "明日",
        deferNextWeek: "来週",
      },
    },

    // Sidebar
    sidebar: {
      context: "コンテキスト",
      nextUp: "次のタスク",
      timeline: "タイムライン",
      close: "閉じる",
    },

    // Dashboard
    dashboard: {
      sidePanelDetailsTitle: "詳細",
      sidePanelOpenAria: "サイドパネルを開く",
    },

    // Timeline
    timeline: {
      today: "今日",
      week: "今週",
      month: "今月",
      custom: "カスタム",
    },

    quickCreate: quickCreateJa,

    // Settings
    settings: {
      title: "設定",
      theme: "カラーテーマ",
      language: "言語",
      themeLight: "ライト",
      themeGray: "グレー",
      themeDark: "ダーク",
      languageJa: "日本語",
      languageEn: "English",
      network: "ネットワーク",
      directModeLabel: "ブラウザから直接 daemon に接続 (実験的)",
      directModeDescription:
        "有効にするとページ表示が速くなりますが、Cookie の SameSite 設定によっては一部ブラウザで失敗します",
      directModeSaved: "保存しました",
      directModeSaveFailed: "保存に失敗しました",
      weekStart: "週の開始日",
      weekStartSunday: "日曜日",
      weekStartMonday: "月曜日",
    },

    // Common
    common: {
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      edit: "編集",
      close: "閉じる",
      loading: "読み込み中",
      confirm: "確認",
      back: "戻る",
    },

    // MiniCalendar
    miniCalendar: {
      prevMonth: "前の月",
      nextMonth: "次の月",
    },

    // Auth
    auth: {
      mfaSetup: {
        title: "2 段階認証のセットアップ",
        guidePrefix: "",
        guideSuffix:
          "のアカウントで認証アプリ (Google Authenticator、1Password、Authy など) による TOTP 認証を有効化します。",
        step1: "認証アプリを開きます。",
        step2: "次のシークレットを Base32 文字列として登録するか、otpauth URL を貼り付けます。",
        step3: "6 桁コードを入力して「検証」を押します。",
        secretLabel: "Secret (Base32)",
        otpauthLabel: "otpauth URL:",
        codeLabel: "6 桁コード",
        verify: "検証",
        codeMismatch: "コードが違います",
        errorPrefix: "エラー:",
        retrySignin: "サインインをやり直す",
      },
    },

    // Side Panels
    panels: {
      tasks: {
        search: "検索",
        searchPlaceholder: "タスクを検索…",
        timeRange: "時間範囲",
        days: "日",
        weeks: "週",
        months: "ヶ月",
        minDuration: "最小所要時間",
        minUnit: "分",
        minutes: "分",
        priorityFilter: "優先度フィルター",
        highPriorityOnly: "高優先度のみ",
        excludeLowPriority: "低優先度を除外",
        resetToDefaults: "デフォルトに戻す",
      },
      calendar: {
        scale: "表示スケール",
        day: "日",
        week: "週",
        month: "月",
        custom: "カスタム",
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
      },
      schedule: {
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
      },
      projects: {
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
        allProjects: "すべてのプロジェクト",
      },
    },

    // Preferences / Account
    preferences: {
      account: {
        title: "アカウント設定",
        profileHeading: "プロフィール情報",
        profileGuide: "メールアドレスとログイン方法を管理します。",
        accountHeading: "アカウント",
        refresh: "更新",
        loading: "読み込み中...",
        email: "メールアドレス",
        emailVerified: "メール確認",
        verified: "確認済み",
        unverified: "未確認",
        accountId: "Account ID",
        changeEmailHeading: "登録メールアドレスの変更",
        newEmail: "新しいメールアドレス",
        sendCode: "変更コードを送信",
        code: "確認コード",
        verifyCode: "コードを確認",
        loginMethods: "ログイン方法",
        passkey: "passkey / 外部ログインを追加・変更",
        emailOtpRelogin: "メールOTPで再ログイン",
        subscriptionHeading: "サブスクリプション",
        subscriptionGuide: "プランと請求情報を管理します。",
        notice: {
          loadFailed: "アカウント情報を読み込めませんでした。再ログインしてください。",
          emailStartFailed: "メールアドレス変更コードを送信できませんでした。",
          emailStartSent: "新しいメールアドレスに確認コードを送信しました。",
          emailVerifyFailed: "確認コードを検証できませんでした。コードを確認してください。",
          emailUpdated: "メールアドレスを更新しました。",
        },
      },
    },

    prompt: {
      actions: {
        startBreak: "休憩開始",
        extend: "延長",
        endBreak: "休憩終了",
        confirmContinue: "そのまま継続",
        confirmStopAt: "停止時刻を記録",
        confirmExecuted: "実行済みにする",
        confirmSkipped: "スキップ済みにする",
      },
    },

    // Tiles
    tiles: {
      actions: {
        start: "開始",
        complete: "完了",
        defer: "先送り",
        interrupt: "中断",
        edit: "編集",
        delete: "削除",
      },
      dialogs: {
        startTitle: "タスクを開始",
        deferTitle: "タスクを先送り",
        interruptTitle: "タスクを中断",
        nextStartAt: "次の開始時刻",
        deleteConfirm: "本当に削除しますか？",
      },
      doneDefinition: "完了条件",
      startAt: "開始",

      duration: "所要",
      noTiles: "タイルがありません",
      unscheduled: "未スケジュール",
      source: {
        break: "休憩",
        sleep: "睡眠",
        legacy: "Source",
      },
      notSet: "未設定",
      closePanel: "パネルを閉じる",
      weekdayAriaPrefix: "曜日",
      inputDate: "日付",
      inputDatetime: "日時",
    },

    // Account
    account: {
      tokens: {
        heading: "APIトークン",
        description:
          "無期限のAPIトークンを複数発行し、APIキーと同じように名前と使用履歴を管理できます。",
        newTokenHeading: "新しいトークン",
        nameLabel: "トークン名",
        issue: "トークンを発行",
        issuedHeading: "発行済みトークン",
        empty: "まだAPIトークンはありません。",
        copied: "コピー済み",
        copy: "コピー",
        revoked: "失効済み",
        rename: "名前変更",
        revoke: "失効",
        meta: {
          createdAt: "作成日",
          lastUsed: "最終使用",
          lastUsedPath: "最終使用パス",
        },
        error: {
          loadFailed: "トークン一覧を取得できませんでした。",
          loadFallback: "トークン一覧の取得に失敗しました。",
          createFailed: "トークンを作成できませんでした。",
          createFallback: "トークン作成に失敗しました。",
          updateFailed: "名前を更新できませんでした。",
          updateFallback: "名前の更新に失敗しました。",
          revokeFailed: "トークンを失効できませんでした。",
          revokeFallback: "トークン失効に失敗しました。",
        },
      },
      subscription: {
        title: "プラン",
        currentPlan: "現在のプラン",
        proBadge: "Pro",
        freeBadge: "Free",
        proDescription: "すべての Pro 機能が使えます",
        freeDescription: "アップグレードして高度な機能を利用",
        upgrade: "Pro にアップグレード",
        manage: "請求を管理",
        monthly: "月額",
        yearly: "年額",
        perMonth: "/月",
        perYear: "/年",
        priceMonthly: "4ドル",
        priceYearly: "40ドル",
        yearHint: "年額は 2 ヶ月分お得",
        statusActive: "有効",
        statusTrialing: "トライアル中",
        statusPastDue: "支払い遅延",
        statusCanceled: "解約済み",
        statusFree: "無料プラン",
        nextBilling: "次回請求日",
        autoRenew: "自動更新",
        autoRenewOff: "自動更新オフ",
        freePlanName: "Free",
        freePlanPrice: "0ドル",
        proPlanName: "Pro",
        proPlanPrice: "4ドル",
        loading: "読み込み中...",
        error: "サブスク情報を取得できませんでした",
        features: {
          free: ["10 タイルまで", "基本的な実行制御", "Web ダッシュボード", "手動タイル管理"],
          pro: [
            "無制限のタイル",
            "高度な自動化",
            "Windows デスクトップクライアント",
            "AI による提案",
            "優先サポート",
            "カスタム連携",
          ],
        },
      },
    },

    marketing: marketingJa,

    marketingLanding: marketingLandingJa,

    // Locale-aware weekday / month labels (used by date formatters in panels).
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },

  en: {
    // Navigation
    nav: {
      execute: "Execute",
      integrations: "Integrations",
      settings: "Settings",
      new: "New",
      timeline: "Timeline",
      tasks: "Tasks",
      projects: "Projects",
      schedule: "Schedule",
      preferences: "Preferences",
    },

    // Shell chrome (activity bar, floating header, etc.)
    shell: {
      activityBar: {
        ariaLabel: "Activity bar",
        sidebarControl: "Sidebar control",
        sidebar: "Sidebar",
        expanded: "Expanded",
        collapsed: "Collapsed",
        expandOnHover: "Expand on hover",
      },
      floatingHeader: {
        homeAria: "tastile home",
        executing: "EXECUTING",
        idle: "IDLE",
        left: "left",
        openSearch: "Open search",
        openNotifications: "Open notifications",
        userMenu: "User menu",
        openNavMenu: "Open navigation menu",
        statusLabel: "Status",
        statusExecuting: "Executing",
        statusIdle: "Idle",
        accountSettings: "Account Settings",
        logOut: "Log out",
        menu: "Menu",
        search: "Search",
        notifications: "Notifications",
      },
    },

    // Notifications (browser/system messages)
    notifications: {
      promptPending: "Action required",
      onBreak: "On break",
      running: "Running",
      accessShareOffer: "Share offer",
      accessRequest: "Access request",
      accessUpdated: "Access updated",
      accessOther: "Access notification",
      generic: "Notification",
    },

    // Header
    header: {
      active: "Active",
      menu: "Menu",
      notifications: "Notifications",
      sync: {
        in_progress: "sync in progress",
        error: "sync error",
        delta: "sync",
        idle: "sync idle",
      },
    },

    // Language toggle
    languageToggle: {
      switchToEnglish: "Switch to English",
      switchToJapanese: "Switch to Japanese",
    },

    // Execution bar
    execution: {
      runningLabel: "Running",
      breakLabel: "On break",
      notStartedLabel: "Not started",
      remainingLabel: "Remaining",
      prompt: {
        startTile: "Start tile",
        endTile: "End tile",
        endBreak: "End break",
        defer30: "30 min",
        defer1h: "1 hour",
        defer2h: "2 hours",
        deferTomorrow: "Tomorrow",
        deferNextWeek: "Next week",
      },
    },

    // Sidebar
    sidebar: {
      context: "Context",
      nextUp: "Next Up",
      timeline: "Timeline",
      close: "Close",
    },

    // Dashboard
    dashboard: {
      sidePanelDetailsTitle: "Details",
      sidePanelOpenAria: "Open side panel",
    },

    // Timeline
    timeline: {
      today: "Today",
      week: "Week",
      month: "Month",
      custom: "Custom",
    },

    quickCreate: quickCreateEn,

    // Settings
    settings: {
      title: "Settings",
      theme: "Color Theme",
      language: "Language",
      themeLight: "Light",
      themeGray: "Gray",
      themeDark: "Dark",
      languageJa: "日本語",
      languageEn: "English",
      network: "Network",
      directModeLabel: "Connect directly to daemon from browser (experimental)",
      directModeDescription:
        "Speeds up page rendering, but may fail in some browsers depending on the Cookie SameSite setting",
      directModeSaved: "Saved",
      directModeSaveFailed: "Failed to save",
      weekStart: "Week Start Day",
      weekStartSunday: "Sunday",
      weekStartMonday: "Monday",
    },

    // Common
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      loading: "Loading",
      confirm: "Confirm",
      back: "Back",
    },

    // MiniCalendar
    miniCalendar: {
      prevMonth: "Previous month",
      nextMonth: "Next month",
    },

    // Auth
    auth: {
      mfaSetup: {
        title: "Two-factor authentication setup",
        guidePrefix: "Enable TOTP for the account",
        guideSuffix: " using an authenticator app (Google Authenticator, 1Password, Authy, etc.).",
        step1: "Open your authenticator app.",
        step2:
          "Register the secret below as a Base32 string, or paste the otpauth URL into your app.",
        step3: "Enter the 6-digit code and press Verify.",
        secretLabel: "Secret (Base32)",
        otpauthLabel: "otpauth URL:",
        codeLabel: "6-digit code",
        verify: "Verify",
        codeMismatch: "Code is incorrect",
        errorPrefix: "Error:",
        retrySignin: "Retry sign-in",
      },
    },

    // Side Panels
    panels: {
      tasks: {
        search: "Search",
        searchPlaceholder: "Search tasks…",
        timeRange: "Time Range",
        days: "days",
        weeks: "weeks",
        months: "months",
        minDuration: "Min Duration",
        minUnit: "min",
        minutes: "minutes",
        priorityFilter: "Priority Filter",
        highPriorityOnly: "High Priority Only",
        excludeLowPriority: "Exclude Low Priority",
        resetToDefaults: "Reset to Defaults",
      },
      calendar: {
        scale: "Scale",
        day: "Day",
        week: "Week",
        month: "Month",
        custom: "Custom",
        projects: "Projects",
        loadingProjects: "Loading projects…",
      },
      schedule: {
        projects: "Projects",
        loadingProjects: "Loading projects…",
      },
      projects: {
        projects: "Projects",
        loadingProjects: "Loading projects…",
        allProjects: "All Projects",
      },
    },

    // Preferences / Account
    preferences: {
      account: {
        title: "Account Settings",
        profileHeading: "Profile Information",
        profileGuide: "Manage your email and sign-in methods.",
        accountHeading: "Account",
        refresh: "Refresh",
        loading: "Loading...",
        email: "Email",
        emailVerified: "Email verification",
        verified: "Verified",
        unverified: "Not verified",
        accountId: "Account ID",
        changeEmailHeading: "Change registered email",
        newEmail: "New email",
        sendCode: "Send change code",
        code: "Verification code",
        verifyCode: "Verify code",
        loginMethods: "Sign-in methods",
        passkey: "Add or change passkey / external sign-in",
        emailOtpRelogin: "Re-login with email OTP",
        subscriptionHeading: "Subscription",
        subscriptionGuide: "Manage your plan and billing.",
        notice: {
          loadFailed: "Could not load account info. Please sign in again.",
          emailStartFailed: "Could not send email change code.",
          emailStartSent: "A verification code has been sent to your new email.",
          emailVerifyFailed: "Could not verify the code. Please check the code.",
          emailUpdated: "Your email has been updated.",
        },
      },
    },

    prompt: {
      actions: {
        startBreak: "Start break",
        extend: "Extend",
        endBreak: "End break",
        confirmContinue: "Continue",
        confirmStopAt: "Record stop time",
        confirmExecuted: "Mark executed",
        confirmSkipped: "Mark skipped",
      },
    },

    // Tiles
    tiles: {
      actions: {
        start: "Start",
        complete: "Complete",
        defer: "Defer",
        interrupt: "Interrupt",
        edit: "Edit",
        delete: "Delete",
      },
      dialogs: {
        startTitle: "Start Task",
        deferTitle: "Defer Task",
        interruptTitle: "Interrupt Task",
        nextStartAt: "Next start time",
        deleteConfirm: "Are you sure you want to delete?",
      },
      doneDefinition: "Done when",
      startAt: "Start",

      duration: "Duration",
      noTiles: "No tiles yet",
      unscheduled: "Unscheduled",
      source: {
        break: "Break",
        sleep: "Sleep",
        legacy: "Source",
      },
      notSet: "Not set",
      closePanel: "Close panel",
      weekdayAriaPrefix: "Weekday",
      inputDate: "date",
      inputDatetime: "datetime",
    },

    // Account
    account: {
      tokens: {
        heading: "API Tokens",
        description:
          "Issue unlimited-lived API tokens and manage names and usage history like API keys.",
        newTokenHeading: "New token",
        nameLabel: "Token name",
        issue: "Issue token",
        issuedHeading: "Issued tokens",
        empty: "No API tokens yet.",
        copied: "Copied",
        copy: "Copy",
        revoked: "Revoked",
        rename: "Rename",
        revoke: "Revoke",
        meta: {
          createdAt: "Created",
          lastUsed: "Last used",
          lastUsedPath: "Last used path",
        },
        error: {
          loadFailed: "Could not load token list.",
          loadFallback: "Failed to load token list.",
          createFailed: "Could not create the token.",
          createFallback: "Failed to create the token.",
          updateFailed: "Could not update the name.",
          updateFallback: "Failed to update the name.",
          revokeFailed: "Could not revoke the token.",
          revokeFallback: "Failed to revoke the token.",
        },
      },
      subscription: {
        title: "Plan",
        currentPlan: "Current Plan",
        proBadge: "Pro",
        freeBadge: "Free",
        proDescription: "You have access to all Pro features",
        freeDescription: "Upgrade to unlock advanced features",
        upgrade: "Upgrade to Pro",
        manage: "Manage Billing",
        monthly: "Monthly",
        yearly: "Yearly",
        perMonth: "/month",
        perYear: "/year",
        priceMonthly: "$4",
        priceYearly: "$40",
        yearHint: "Save 2 months with yearly",
        statusActive: "Active",
        statusTrialing: "Trialing",
        statusPastDue: "Past due",
        statusCanceled: "Canceled",
        statusFree: "Free plan",
        nextBilling: "Next billing",
        autoRenew: "Auto-renew on",
        autoRenewOff: "Auto-renew off",
        freePlanName: "Free",
        freePlanPrice: "$0",
        proPlanName: "Pro",
        proPlanPrice: "$4",
        loading: "Loading...",
        error: "Could not load subscription info",
        features: {
          free: [
            "Up to 10 active tiles",
            "Basic execution control",
            "Web dashboard access",
            "Manual tile management",
          ],
          pro: [
            "Unlimited tiles",
            "Advanced automation",
            "Windows desktop client",
            "AI-powered suggestions",
            "Priority support",
            "Custom integrations",
          ],
        },
      },
    },

    marketing: marketingEn,

    marketingLanding: marketingLandingEn,

    // Locale-aware weekday / month labels (used by date formatters in panels).
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },

  // Placeholder locales — fall back to English (useTranslation() resolves any
  // missing key against the `en` tree before returning an empty string). This
  // keeps the locale switcher honest about which locales are advertised and
  // gives the type system a precise `Locale` key set without us having to
  // hand-translate every section into seven languages up-front.
  de: {} as unknown as (typeof translations)["en"],
  es: {} as unknown as (typeof translations)["en"],
  "pt-BR": {} as unknown as (typeof translations)["en"],
  fr: {} as unknown as (typeof translations)["en"],
  ko: {} as unknown as (typeof translations)["en"],
  "zh-CN": {} as unknown as (typeof translations)["en"],
} as Record<string, unknown>;

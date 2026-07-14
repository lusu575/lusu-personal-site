import { UI_LANGUAGES } from "./constants.mjs?v=20260712-japanese-subtext-v103-r6";

const copy = {
  zh: {
    toolTitle: "日语的言外之意", toolVersion: "版本 1.0.3", uiLanguage: "界面语言", backSite: "返回个人站", trainingConsole: "训练控制台", saveSync: "存档同步", startSound: "听力练习模式",
    modeChoiceIntro: "请选择首次进入关卡时使用的练习方式。之后可以在训练设置中切换。", modeChoiceAudioUnavailable: "语音暂时无法载入，听力模式已停用。请先使用日语或双语模式。", listeningUnavailable: "当前语音不可用，暂时不能进入听力模式。", japaneseModeEntry: "日语模式", bilingualModeEntry: "双语模式",
    dashboardEyebrow: "语境听力实验室 · 250 关", dashboardIntro: "从语气、停顿、关系和上下文里，听见没说出口的话。",
    startChallenge: "开始挑战", continueTraining: "继续挑战", chooseStage: "选择关卡", settings: "训练设置", records: "学习记录",
    currentLevel: "当前等级", currentStage: "当前关卡", clearedStages: "已完成关卡", totalStages: "总关卡",
    chooseLevel: "选择难度", stageMap: "关卡地图", backDashboard: "返回启动页", backMap: "返回关卡地图",
    level: "难度", stage: "关卡", jlpt: "日语难度", locked: "未解锁", unlocked: "已解锁", cleared: "已通关", current: "当前",
    bronze: "铜牌", silver: "银牌", gold: "金牌", noMedal: "未获奖章", medalEarned: "本关奖章",
    scene: "场景", questions: "问题", analysis: "潜台词解析", audioPlayer: "语音播放器", unknownSpeaker: "未知角色", loading: "正在读取题目…", readyStatus: "已准备",
    loadFailed: "题目读取失败。", retry: "重新加载", textModeContinue: "使用日语模式继续",
    audioUnavailable: "语音暂时无法载入。", audioReady: "语音已准备好。", cloudUnavailable: "云端进度暂不可用，本地进度仍会保存。",
    displayMode: "场景显示", listening: "纯听模式", japanese: "日语模式", bilingual: "双语模式",
    kana: "假名提示", optionLanguage: "选项语言", optionText: "选项文字", optionAudio: "选项日语语音",
    autoReadOptions: "自动依次朗读选项", autoplay: "进入关卡自动播放", on: "开启", off: "关闭",
    playbackSpeed: "播放速度", mute: "静音", resetProgress: "重置本地进度", resetConfirm: "确定清空本工具的本地进度吗？",
    play: "播放", pause: "暂停", resume: "继续", restart: "从头播放", replay: "重播", previousLine: "上一句", nextLine: "下一句",
    progress: "播放进度", singleLineReplay: "单句重播", playSentence: "播放这句话", playChunk: "播放这个词块", playOption: "播放选项",
    answerAfterListening: "场景播放结束后即可答题。", enableQuestions: "开始答题", selectOne: "请选择一项。", selectMany: "可选择多项。", answerRequired: "第 {number} 题还没有作答，请先选择答案。",
    submitAnswers: "提交答案", tryAgain: "重新作答", nextStage: "下一关", allCorrect: "全部答对，本关通过！", notAllCorrect: "还有答案不对，可以根据解析再试一次。", correctAnswer: "正确答案", yourWrongChoice: "你选择的错误答案",
    literal: "字面意思", intent: "真正意图", evidence: "判断线索", nuance: "语气与语法", alternative: "其他可能解释",
    attempts: "尝试次数", firstAccuracy: "首次答题正确率", bestScore: "最佳成绩", replayCount: "重播次数",
    settingsSaved: "设置已保存。", localDamaged: "检测到本地存档异常，已尽量保留可解析数据。", voiceCredits: "语音来源与许可", close: "关闭", confirm: "确认",
    optionAvailabilityNote: "选项文字与日语语音至少保留一种。", optionAvailabilityRequired: "不能同时关闭选项文字和语音。已为你保留另一种。", modeRequired: "请先选择一种练习模式。",
    resultTitle: "挑战结果", resultMedal: "获得奖牌", noMedal: "本次未获得奖牌", viewAnalysis: "查看解析", enterNextStage: "进入下一关", retryChallenge: "重新挑战", resultActionRequired: "请选择一个当前可用的操作。",
    authLocal: "未登录 · 使用本地进度", authCloud: "已登录 · 云端进度已合并", syncing: "正在同步云端进度…", synced: "云端进度已同步",
    illustrationAltFallback: "与当前场景相关的辅助插图", illustrationLoadFailed: "配图暂时未能载入。", retryIllustration: "重试配图", illustrationRetrying: "正在重新载入配图…", sentenceHidden: "纯听模式：台词已隐藏", optionHidden: "选项文字已隐藏。",
    emptyRecord: "还没有学习打卡。完成一次答题后，这里会点亮当天。", recordsSummary: "每天完成一次答题即视为打卡，记录会随进度一起保存。",
    checkedInToday: "今日已打卡", notCheckedInToday: "今日未打卡", currentStreak: "当前连续", longestStreak: "最长连续", totalStudyDays: "累计学习", dayUnit: "天",
    previousMonth: "上个月", nextMonth: "下个月", checkInCalendar: "学习打卡月历", recentActivity: "最近学习", practicedStages: "练习关卡", clearedOnDay: "当日通关",
    checkInAria: "{date}，已打卡，练习 {count} 关", noCheckInAria: "{date}，未打卡", weekdayLabels: ["一", "二", "三", "四", "五", "六", "日"],
    levelDescriptions: ["N3 · 日常表达与明显线索", "N2 · 口语省略、转折与敬语距离", "N1 · 复杂语气、讽刺与信息差", "N1 高阶 · 多人推理与不可靠叙述", "N1 语用挑战 · 多重含义与开放结局"]
  },
  en: {
    toolTitle: "Behind the Japanese", toolVersion: "Version 1.0.3", uiLanguage: "Interface language", backSite: "Back to Site", trainingConsole: "Training Console", saveSync: "Save Sync", startSound: "Listening Practice",
    modeChoiceIntro: "Choose how to enter your first stage. You can change this later in Training Settings.", modeChoiceAudioUnavailable: "Audio is unavailable, so Listening Practice is disabled. Choose Japanese or Bilingual Mode for now.", listeningUnavailable: "Audio is unavailable, so Listening Practice cannot be selected yet.", japaneseModeEntry: "Japanese Mode", bilingualModeEntry: "Bilingual Mode",
    dashboardEyebrow: "Context Listening Lab · 250 Stages", dashboardIntro: "Hear what was left unsaid through tone, pauses, relationships, and context.",
    startChallenge: "Start Challenge", continueTraining: "Continue Challenge", chooseStage: "Choose Stage", settings: "Training Settings", records: "Learning Record",
    currentLevel: "Current level", currentStage: "Current stage", clearedStages: "Stages cleared", totalStages: "Total stages",
    chooseLevel: "Choose Difficulty", stageMap: "Stage Map", backDashboard: "Back to Start", backMap: "Back to Stage Map",
    level: "Level", stage: "Stage", jlpt: "Japanese level", locked: "Locked", unlocked: "Unlocked", cleared: "Cleared", current: "Current",
    bronze: "Bronze", silver: "Silver", gold: "Gold", noMedal: "No medal", medalEarned: "Stage medal",
    scene: "Scene", questions: "Questions", analysis: "Subtext Analysis", audioPlayer: "Audio player", unknownSpeaker: "Unknown character", loading: "Loading stage…", readyStatus: "Ready",
    loadFailed: "The stage could not be loaded.", retry: "Retry", textModeContinue: "Continue in Japanese Mode",
    audioUnavailable: "Audio is temporarily unavailable.", audioReady: "Audio is ready.", cloudUnavailable: "Cloud progress is unavailable. Local progress will still be saved.",
    displayMode: "Scene display", listening: "Listening only", japanese: "Japanese", bilingual: "Bilingual",
    kana: "Kana hints", optionLanguage: "Option language", optionText: "Option text", optionAudio: "Japanese option audio",
    autoReadOptions: "Read options in sequence", autoplay: "Autoplay on stage entry", on: "On", off: "Off",
    playbackSpeed: "Playback speed", mute: "Mute", resetProgress: "Reset local progress", resetConfirm: "Clear local progress for this tool?",
    play: "Play", pause: "Pause", resume: "Resume", restart: "Start over", replay: "Replay", previousLine: "Previous line", nextLine: "Next line",
    progress: "Playback progress", singleLineReplay: "Replay sentence", playSentence: "Play this sentence", playChunk: "Play this phrase", playOption: "Play option",
    answerAfterListening: "Questions unlock after the scene audio finishes.", enableQuestions: "Start Questions", selectOne: "Choose one.", selectMany: "Choose all that apply.", answerRequired: "Question {number} is unanswered. Choose an answer before submitting.",
    submitAnswers: "Submit Answers", tryAgain: "Try Again", nextStage: "Next Stage", allCorrect: "All correct — stage cleared!", notAllCorrect: "Some answers need another look. Use the analysis and try again.", correctAnswer: "Correct answer", yourWrongChoice: "Your incorrect choice",
    literal: "Literal meaning", intent: "Likely intention", evidence: "Evidence", nuance: "Tone and grammar", alternative: "Other plausible readings",
    attempts: "Attempts", firstAccuracy: "First-attempt accuracy", bestScore: "Best score", replayCount: "Replays",
    settingsSaved: "Settings saved.", localDamaged: "Local data looked damaged; recoverable fields were kept.", voiceCredits: "Voice Credits & Licenses", close: "Close", confirm: "Confirm",
    optionAvailabilityNote: "Keep at least one of option text or Japanese audio enabled.", optionAvailabilityRequired: "Option text and audio cannot both be off. The other format was kept on.", modeRequired: "Choose a practice mode before continuing.",
    resultTitle: "Challenge Result", resultMedal: "Medal earned", noMedal: "No medal earned this time", viewAnalysis: "View Analysis", enterNextStage: "Enter Next Stage", retryChallenge: "Try Again", resultActionRequired: "Choose one of the actions currently available.",
    authLocal: "Signed out · Local progress", authCloud: "Signed in · Cloud progress merged", syncing: "Syncing cloud progress…", synced: "Cloud progress synced",
    illustrationAltFallback: "Supporting illustration for this scene", illustrationLoadFailed: "The scene illustration could not be loaded.", retryIllustration: "Retry Illustration", illustrationRetrying: "Reloading the illustration…", sentenceHidden: "Listening-only mode: dialogue hidden", optionHidden: "Option text is hidden.",
    emptyRecord: "No study check-ins yet. Complete one answer attempt to light up today.", recordsSummary: "Any completed answer attempt counts as a daily check-in and syncs with progress.",
    checkedInToday: "Checked in today", notCheckedInToday: "Not checked in today", currentStreak: "Current streak", longestStreak: "Longest streak", totalStudyDays: "Study days", dayUnit: "days",
    previousMonth: "Previous month", nextMonth: "Next month", checkInCalendar: "Study Check-in Calendar", recentActivity: "Recent Activity", practicedStages: "Stages practiced", clearedOnDay: "Cleared that day",
    checkInAria: "{date}, checked in, {count} stages practiced", noCheckInAria: "{date}, no check-in", weekdayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    levelDescriptions: ["N3 · Daily expressions and clear clues", "N2 · Ellipsis, contrast, and polite distance", "N1 · Complex tone, irony, and information gaps", "Advanced N1 · Multi-speaker reasoning and unreliable accounts", "N1 pragmatics · Multiple readings and open endings"]
  },
  ja: {
    toolTitle: "日本語の裏側", toolVersion: "バージョン 1.0.3", uiLanguage: "表示言語", backSite: "サイトへ戻る", trainingConsole: "トレーニング操作", saveSync: "セーブ同期", startSound: "聴解練習モード",
    modeChoiceIntro: "初めてステージに入るときの練習方法を選んでください。あとからトレーニング設定で変更できます。", modeChoiceAudioUnavailable: "音声を読み込めないため、聴解練習モードは一時的に選べません。日本語または二言語モードを選んでください。", listeningUnavailable: "現在は音声を利用できないため、聴解練習モードを選べません。", japaneseModeEntry: "日本語モード", bilingualModeEntry: "二言語モード",
    dashboardEyebrow: "文脈リスニング・ラボ · 250ステージ", dashboardIntro: "声色、間、関係、文脈から、言葉にされなかった本音を読み取ります。",
    startChallenge: "チャレンジ開始", continueTraining: "続きから挑戦", chooseStage: "ステージ選択", settings: "トレーニング設定", records: "学習記録",
    currentLevel: "現在のレベル", currentStage: "現在のステージ", clearedStages: "クリア数", totalStages: "全ステージ",
    chooseLevel: "難易度を選ぶ", stageMap: "ステージマップ", backDashboard: "スタートへ", backMap: "マップへ戻る",
    level: "難易度", stage: "ステージ", jlpt: "日本語難度", locked: "未解放", unlocked: "解放済み", cleared: "クリア", current: "現在",
    bronze: "銅", silver: "銀", gold: "金", noMedal: "メダルなし", medalEarned: "ステージメダル",
    scene: "場面", questions: "問題", analysis: "含意の解説", audioPlayer: "音声プレーヤー", unknownSpeaker: "不明な登場人物", loading: "問題を読み込み中…", readyStatus: "準備完了",
    loadFailed: "問題を読み込めませんでした。", retry: "再読み込み", textModeContinue: "日本語モードで続ける",
    audioUnavailable: "音声を一時的に読み込めません。", audioReady: "音声の準備ができました。", cloudUnavailable: "クラウド進捗は利用できません。ローカル進捗は保存されます。",
    displayMode: "場面表示", listening: "聞き取りのみ", japanese: "日本語", bilingual: "日本語＋補足",
    kana: "かなヒント", optionLanguage: "選択肢の言語", optionText: "選択肢の文字", optionAudio: "選択肢の日本語音声",
    autoReadOptions: "選択肢を順に読む", autoplay: "入場時に自動再生", on: "オン", off: "オフ",
    playbackSpeed: "再生速度", mute: "ミュート", resetProgress: "ローカル進捗をリセット", resetConfirm: "このツールのローカル進捗を消去しますか？",
    play: "再生", pause: "一時停止", resume: "続ける", restart: "最初から", replay: "リプレイ", previousLine: "前の文", nextLine: "次の文",
    progress: "再生位置", singleLineReplay: "一文を再生", playSentence: "この文を再生", playChunk: "この語句を再生", playOption: "選択肢を再生",
    answerAfterListening: "場面音声の終了後に解答できます。", enableQuestions: "解答を始める", selectOne: "一つ選んでください。", selectMany: "複数選択できます。", answerRequired: "{number}問目が未回答です。回答を選んでください。",
    submitAnswers: "回答する", tryAgain: "もう一度", nextStage: "次のステージ", allCorrect: "全問正解、クリアです！", notAllCorrect: "まだ違う答えがあります。解説を手がかりに再挑戦できます。", correctAnswer: "正解", yourWrongChoice: "選んだ誤答",
    literal: "字面の意味", intent: "考えられる意図", evidence: "判断の手がかり", nuance: "語気と文法", alternative: "ほかの可能な解釈",
    attempts: "挑戦回数", firstAccuracy: "初回正答率", bestScore: "最高得点", replayCount: "再生回数",
    settingsSaved: "設定を保存しました。", localDamaged: "ローカルデータの異常を検出し、読み取れる項目を保持しました。", voiceCredits: "音声の出典とライセンス", close: "閉じる", confirm: "確認",
    optionAvailabilityNote: "選択肢の文字と日本語音声のどちらかは有効にしてください。", optionAvailabilityRequired: "選択肢の文字と音声を同時にオフにはできません。もう一方を有効にしました。", modeRequired: "練習モードを選んでください。",
    resultTitle: "チャレンジ結果", resultMedal: "獲得メダル", noMedal: "今回はメダルを獲得できませんでした", viewAnalysis: "解説を見る", enterNextStage: "次のステージへ", retryChallenge: "再挑戦", resultActionRequired: "現在利用できる操作を一つ選んでください。",
    authLocal: "未ログイン · ローカル進捗", authCloud: "ログイン済み · クラウド進捗を統合", syncing: "クラウド進捗を同期中…", synced: "クラウド進捗を同期しました",
    illustrationAltFallback: "この場面を補助するイラスト", illustrationLoadFailed: "シーンイラストを読み込めませんでした。", retryIllustration: "イラストを再読み込み", illustrationRetrying: "イラストを再読み込み中…", sentenceHidden: "聞き取りのみ：台詞は非表示です", optionHidden: "選択肢の文字は非表示です。",
    emptyRecord: "学習チェックインはまだありません。一度解答すると、その日が点灯します。", recordsSummary: "一度でも解答を完了すると当日のチェックインになり、進捗と一緒に保存されます。",
    checkedInToday: "今日はチェックイン済み", notCheckedInToday: "今日は未チェックイン", currentStreak: "現在の連続", longestStreak: "最長連続", totalStudyDays: "累計学習", dayUnit: "日",
    previousMonth: "前の月", nextMonth: "次の月", checkInCalendar: "学習チェックインカレンダー", recentActivity: "最近の学習", practicedStages: "練習ステージ", clearedOnDay: "当日クリア",
    checkInAria: "{date}、チェックイン済み、{count}ステージ練習", noCheckInAria: "{date}、未チェックイン", weekdayLabels: ["月", "火", "水", "木", "金", "土", "日"],
    levelDescriptions: ["N3 · 日常表現と分かりやすい手がかり", "N2 · 省略、逆接、敬語の距離", "N1 · 複雑な語気、皮肉、情報差", "N1上級 · 複数人物と信頼できない語り", "N1語用論 · 多義性と開かれた結末"]
  }
};

const genreLabels = {
  zh: {
    absurdism: "荒诞主义", AI: "AI", "alternate-history": "架空历史", "anime-culture": "动漫文化", broadcast: "广播", comedy: "喜剧", "convenience-store": "便利店", "daily-life": "日常生活", dream: "梦境", "fairy-tale": "童话", fantasy: "奇幻", games: "游戏", "meta-fiction": "元叙事", "mild-horror": "轻度恐怖", "mobile-chat": "手机聊天", mystery: "悬疑", news: "新闻", "online-chat": "网络聊天", "open-ending": "开放结局", restaurant: "餐厅", school: "校园", "sci-fi": "科幻", space: "太空", supernatural: "超自然", "time-loop": "时间循环", translation: "翻译", travel: "旅行", "unreliable-narrator": "不可靠叙述", voicemail: "语音留言", VRChat: "VRChat", workplace: "职场"
  },
  en: {
    absurdism: "Absurdism", AI: "AI", "alternate-history": "Alternate history", "anime-culture": "Anime culture", broadcast: "Broadcast", comedy: "Comedy", "convenience-store": "Convenience store", "daily-life": "Daily life", dream: "Dream", "fairy-tale": "Fairy tale", fantasy: "Fantasy", games: "Games", "meta-fiction": "Metafiction", "mild-horror": "Mild horror", "mobile-chat": "Mobile chat", mystery: "Mystery", news: "News", "online-chat": "Online chat", "open-ending": "Open ending", restaurant: "Restaurant", school: "School", "sci-fi": "Science fiction", space: "Space", supernatural: "Supernatural", "time-loop": "Time loop", translation: "Translation", travel: "Travel", "unreliable-narrator": "Unreliable narrator", voicemail: "Voicemail", VRChat: "VRChat", workplace: "Workplace"
  },
  ja: {
    absurdism: "不条理", AI: "AI", "alternate-history": "架空歴史", "anime-culture": "アニメ文化", broadcast: "放送", comedy: "コメディ", "convenience-store": "コンビニ", "daily-life": "日常", dream: "夢", "fairy-tale": "童話", fantasy: "ファンタジー", games: "ゲーム", "meta-fiction": "メタフィクション", "mild-horror": "軽いホラー", "mobile-chat": "モバイルチャット", mystery: "ミステリー", news: "ニュース", "online-chat": "オンラインチャット", "open-ending": "オープンエンド", restaurant: "レストラン", school: "学校", "sci-fi": "SF", space: "宇宙", supernatural: "超常現象", "time-loop": "タイムループ", translation: "翻訳", travel: "旅行", "unreliable-narrator": "信頼できない語り手", voicemail: "ボイスメール", VRChat: "VRChat", workplace: "職場"
  }
};

export function normalizeUiLanguage(value) {
  return UI_LANGUAGES.includes(value) ? value : "zh";
}

export function createTranslator(getLanguage) {
  return (key, replacements = {}) => {
    const lang = normalizeUiLanguage(getLanguage());
    const raw = copy[lang]?.[key] ?? copy.zh[key] ?? key;
    if (Array.isArray(raw)) return raw;
    return Object.entries(replacements).reduce((text, [name, value]) => String(text).split(`{${name}}`).join(String(value)), raw);
  };
}

export function languageLabel(code, uiLanguage = "zh") {
  const labels = {
    zh: { zh: "中文", en: "English", ja: "日本語" },
    en: { zh: "Chinese", en: "English", ja: "Japanese" },
    ja: { zh: "中国語", en: "英語", ja: "日本語" }
  };
  return labels[uiLanguage]?.[code] || labels.zh[code] || code;
}

export function genreLabel(code, uiLanguage = "zh") {
  const lang = normalizeUiLanguage(uiLanguage);
  return genreLabels[lang]?.[code] || genreLabels.en[code] || code;
}

// ============================================================
// 電話OK / NG共有アプリ
// app.js
// ============================================================


// ============================================================
// 1. Supabase設定
// ============================================================

// ★ここは自分のSupabaseの Project URL
// 「/rest/v1/」は付けない
const SUPABASE_URL =
    "https://yukoyuko-cloud.github.io/phone-status-app/?room=7e298230-8294-4a68-adb7-c5b4d5849888";

// ★ここはSupabaseの Publishable key
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_M997uooOd5ovhvCPYWfOAQ_qIUqLBp1";


// Supabaseクライアント作成
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ============================================================
// 2. DOM取得
// ============================================================

const statusCard =
    document.getElementById("statusCard");

const statusIcon =
    document.getElementById("statusIcon");

const statusText =
    document.getElementById("statusText");

const remainingTime =
    document.getElementById("remainingTime");

const roomDisplay =
    document.getElementById("roomDisplay");

const hoursInput =
    document.getElementById("hoursInput");

const minutesInput =
    document.getElementById("minutesInput");

const okButton =
    document.getElementById("okButton");

const ngButton =
    document.getElementById("ngButton");

const copyButton =
    document.getElementById("copyButton");

const message =
    document.getElementById("message");


// ============================================================
// 3. グローバル変数
// ============================================================

let roomId = null;

let currentStatus = "ng";

let currentExpiresAt = null;

let countdownTimer = null;

let realtimeChannel = null;

let isUpdating = false;


// ============================================================
// 4. room_id取得
// ============================================================

function getRoomId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    let room =
        params.get("room");


    // roomが存在しない場合
    if (!room) {

        room =
            crypto.randomUUID();

        const newUrl =
            `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;

        window.history.replaceState(
            {},
            "",
            newUrl
        );
    }


    // room_idの形式チェック
    // 英数字、_、- を3～64文字まで許可
    const validRoomId =
        /^[A-Za-z0-9_-]{3,64}$/;


    if (!validRoomId.test(room)) {

        throw new Error(
            "不正なroom_idです"
        );
    }


    return room;
}


// ============================================================
// 5. メッセージ表示
// ============================================================

function showMessage(
    text,
    type = ""
) {

    message.textContent = text;

    message.className =
        "message";

    if (type) {

        message.classList.add(type);
    }
}


// ============================================================
// 6. ボタンの有効 / 無効
// ============================================================

function setButtonsDisabled(
    disabled
) {

    okButton.disabled =
        disabled;

    ngButton.disabled =
        disabled;

    copyButton.disabled =
        disabled;
}


// ============================================================
// 7. room表示
// ============================================================

function renderRoomId() {

    roomDisplay.textContent =
        `Room: ${roomId}`;
}


// ============================================================
// 8. 状態を画面へ反映
// ============================================================

function renderStatus(
    status,
    expiresAt
) {

    currentStatus =
        status;

    currentExpiresAt =
        expiresAt;


    // ========================================
    // OK
    // ========================================

    if (
        status === "ok" &&
        expiresAt
    ) {

        statusCard.classList.remove(
            "ng"
        );

        statusCard.classList.add(
            "ok"
        );

        statusIcon.textContent =
            "🟢";

        statusText.textContent =
            "電話してOK";

        updateCountdown();

        startCountdown();

        return;
    }


    // ========================================
    // NG
    // ========================================

    stopCountdown();

    statusCard.classList.remove(
        "ok"
    );

    statusCard.classList.add(
        "ng"
    );

    statusIcon.textContent =
        "🔴";

    statusText.textContent =
        "今は電話できません";

    remainingTime.textContent =
        "";
}


// ============================================================
// 9. 残り時間計算
// ============================================================

function formatRemainingTime(
    milliseconds
) {

    if (
        milliseconds <= 0
    ) {

        return "まもなく自動的にNGになります";
    }


    let totalSeconds =
        Math.floor(
            milliseconds / 1000
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    totalSeconds %= 3600;


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    // 1時間以上
    if (hours >= 1) {

        return (
            `あと ${hours}時間` +
            `${minutes}分` +
            `${seconds}秒`
        );
    }


    // 1時間未満
    if (minutes >= 1) {

        return (
            `あと ${minutes}分` +
            `${seconds}秒`
        );
    }


    // 1分未満
    return (
        `あと ${seconds}秒`
    );
}


// ============================================================
// 10. カウントダウン更新
// ============================================================

function updateCountdown() {

    if (
        currentStatus !== "ok" ||
        !currentExpiresAt
    ) {

        remainingTime.textContent =
            "";

        return;
    }


    const expiresTime =
        new Date(
            currentExpiresAt
        ).getTime();


    const now =
        Date.now();


    const remaining =
        expiresTime - now;


    remainingTime.textContent =
        formatRemainingTime(
            remaining
        );


    // ========================================
    // 期限到達
    // ========================================

    if (remaining <= 0) {

        handleLocalExpiration();
    }
}


// ============================================================
// 11. カウントダウン開始
// ============================================================

function startCountdown() {

    stopCountdown();


    countdownTimer =
        setInterval(
            () => {

                updateCountdown();

            },
            1000
        );
}


// ============================================================
// 12. カウントダウン停止
// ============================================================

function stopCountdown() {

    if (
        countdownTimer
    ) {

        clearInterval(
            countdownTimer
        );

        countdownTimer =
            null;
    }
}


// ============================================================
// 13. ブラウザ側で期限到達を検知
// ============================================================

async function handleLocalExpiration() {

    stopCountdown();


    remainingTime.textContent =
        "まもなく自動的にNGになります";


    // DB側のCronが処理する前に
    // 開いているブラウザからNG更新を試みる
    try {

        const { error } =
            await supabaseClient
                .from("rooms")
                .update({
                    status: "ng",
                    expires_at: null
                })
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "status",
                    "ok"
                );


        if (error) {

            console.error(
                "期限切れ更新エラー:",
                error
            );

            // Cronが後から処理するので
            // ここでは画面だけNGにする
            renderStatus(
                "ng",
                null
            );

            return;
        }


        renderStatus(
            "ng",
            null
        );

    } catch (error) {

        console.error(
            "期限切れ処理エラー:",
            error
        );

        renderStatus(
            "ng",
            null
        );
    }
}


// ============================================================
// 14. room取得
// ============================================================

async function fetchRoom() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("rooms")
            .select(
                "room_id,status,expires_at,created_at"
            )
            .eq(
                "room_id",
                roomId
            )
            .maybeSingle();


        if (error) {

            console.error(
                "room取得エラー:",
                error
            );

            throw error;
        }


        // ========================================
        // roomが存在する
        // ========================================

        if (data) {

            renderStatus(
                data.status,
                data.expires_at
            );

            return;
        }


        // ========================================
        // roomが存在しない
        // ========================================

        await createRoom();

    } catch (error) {

        console.error(
            "room取得処理エラー:",
            error
        );

        showMessage(
            "状態の取得に失敗しました",
            "error"
        );
    }
}


// ============================================================
// 15. room作成
// ============================================================

async function createRoom() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("rooms")
            .insert({
                room_id: roomId,
                status: "ng",
                expires_at: null
            })
            .select(
                "room_id,status,expires_at,created_at"
            )
            .single();


        // ========================================
        // 同時アクセスによる重複作成
        // ========================================

        if (
            error
        ) {

            console.error(
                "room作成エラー:",
                error
            );


            // すでに別ブラウザが
            // 同じroomを作った可能性がある
            const {
                data: existingRoom,
                error: fetchError
            } = await supabaseClient
                .from("rooms")
                .select(
                    "room_id,status,expires_at,created_at"
                )
                .eq(
                    "room_id",
                    roomId
                )
                .maybeSingle();


            if (
                !fetchError &&
                existingRoom
            ) {

                renderStatus(
                    existingRoom.status,
                    existingRoom.expires_at
                );

                return;
            }


            throw error;
        }


        renderStatus(
            data.status,
            data.expires_at
        );


    } catch (error) {

        console.error(
            "room作成処理エラー:",
            error
        );

        showMessage(
            "roomの作成に失敗しました",
            "error"
        );
    }
}


// ============================================================
// 16. 電話OKに変更
// ============================================================

async function setPhoneOk() {

    if (isUpdating) {
        return;
    }


    isUpdating = true;

    setButtonsDisabled(
        true
    );

    showMessage(
        "更新しています..."
    );


    try {

        const hours =
            Number(
                hoursInput.value
            );

        const minutes =
            Number(
                minutesInput.value
            );


        // ========================================
        // 入力チェック
        // ========================================

        if (
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes)
        ) {

            throw new Error(
                "時間を正しく入力してください"
            );
        }


        if (
            hours < 0 ||
            hours > 23
        ) {

            throw new Error(
                "時間は0～23時間で入力してください"
            );
        }


        if (
            minutes < 0 ||
            minutes > 59
        ) {

            throw new Error(
                "分は0～59分で入力してください"
            );
        }


        const totalMinutes =
            hours * 60 + minutes;


        if (
            totalMinutes <= 0
        ) {

            throw new Error(
                "1分以上を指定してください"
            );
        }


        // ========================================
        // 現在時刻から期限を計算
        // ========================================

        const expiresAt =
            new Date(
                Date.now() +
                totalMinutes * 60 * 1000
            ).toISOString();


        console.log(
            "expires_at:",
            expiresAt
        );


        // ========================================
        // Supabase更新
        // ========================================

        const {
            data,
            error
        } = await supabaseClient
            .from("rooms")
            .update({
                status: "ok",
                expires_at: expiresAt
            })
            .eq(
                "room_id",
                roomId
            )
            .select(
                "room_id,status,expires_at"
            )
            .single();


        if (error) {

            console.error(
                "電話OK更新エラー:",
                error
            );

            throw error;
        }


        // ========================================
        // 自分の画面を更新
        // ========================================

        renderStatus(
            data.status,
            data.expires_at
        );


        showMessage(
            "電話OKに変更しました",
            "success"
        );


    } catch (error) {

        console.error(
            "電話OK処理エラー:",
            error
        );

        showMessage(
            error.message ||
            "状態の更新に失敗しました",
            "error"
        );


    } finally {

        isUpdating = false;

        setButtonsDisabled(
            false
        );
    }
}


// ============================================================
// 17. 電話NGに変更
// ============================================================

async function setPhoneNg() {

    if (isUpdating) {
        return;
    }


    isUpdating = true;

    setButtonsDisabled(
        true
    );

    showMessage(
        "更新しています..."
    );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("rooms")
            .update({
                status: "ng",
                expires_at: null
            })
            .eq(
                "room_id",
                roomId
            )
            .select(
                "room_id,status,expires_at"
            )
            .single();


        if (error) {

            console.error(
                "電話NG更新エラー:",
                error
            );

            throw error;
        }


        renderStatus(
            data.status,
            data.expires_at
        );


        showMessage(
            "今は電話できない状態にしました",
            "success"
        );


    } catch (error) {

        console.error(
            "電話NG処理エラー:",
            error
        );

        showMessage(
            "状態の更新に失敗しました",
            "error"
        );


    } finally {

        isUpdating = false;

        setButtonsDisabled(
            false
        );
    }
}


// ============================================================
// 18. URLコピー
// ============================================================

async function copyCurrentUrl() {

    try {

        const url =
            window.location.href;


        // ========================================
        // Clipboard API
        // ========================================

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                url
            );

        } else {

            // ====================================
            // 古いブラウザ向け
            // ====================================

            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value =
                url;

            textarea.style.position =
                "fixed";

            textarea.style.left =
                "-9999px";

            document.body.appendChild(
                textarea
            );

            textarea.focus();

            textarea.select();

            document.execCommand(
                "copy"
            );

            textarea.remove();
        }


        showMessage(
            "URLをコピーしました",
            "success"
        );


    } catch (error) {

        console.error(
            "URLコピーエラー:",
            error
        );

        showMessage(
            "URLのコピーに失敗しました",
            "error"
        );
    }
}


// ============================================================
// 19. Realtime設定
// ============================================================

function subscribeToRoom() {

    // すでに購読している場合
    if (
        realtimeChannel
    ) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel =
            null;
    }


    realtimeChannel =
        supabaseClient
            .channel(
                `room-${roomId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rooms",
                    filter:
                        `room_id=eq.${roomId}`
                },
                payload => {

                    console.log(
                        "Realtime UPDATE:",
                        payload
                    );


                    const newData =
                        payload.new;


                    if (
                        newData.room_id !== roomId
                    ) {

                        return;
                    }


                    renderStatus(
                        newData.status,
                        newData.expires_at
                    );


                    showMessage(
                        "状態が更新されました",
                        "success"
                    );
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Realtime状態:",
                        status
                    );


                    if (
                        status === "SUBSCRIBED"
                    ) {

                        console.log(
                            "Realtime接続成功"
                        );

                    } else if (
                        status ===
                        "CHANNEL_ERROR"
                    ) {

                        console.error(
                            "Realtime接続エラー"
                        );

                        showMessage(
                            "リアルタイム接続に失敗しました",
                            "error"
                        );

                    } else if (
                        status ===
                        "TIMED_OUT"
                    ) {

                        console.error(
                            "Realtime接続タイムアウト"
                        );

                        showMessage(
                            "リアルタイム接続がタイムアウトしました",
                            "error"
                        );
                    }
                }
            );
}


// ============================================================
// 20. ボタンイベント
// ============================================================

okButton.addEventListener(
    "click",
    setPhoneOk
);


ngButton.addEventListener(
    "click",
    setPhoneNg
);


copyButton.addEventListener(
    "click",
    copyCurrentUrl
);


// ============================================================
// 21. ページを閉じる / バックグラウンド
// ============================================================

// ブラウザを戻ったり別ページへ移動した場合
// カウントダウンタイマーを停止
window.addEventListener(
    "pagehide",
    () => {

        stopCountdown();

        if (
            realtimeChannel
        ) {

            supabaseClient
                .removeChannel(
                    realtimeChannel
                );
        }
    }
);


// ページが再び表示されたとき
// DBから最新状態を取得
document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            fetchRoom();
        }
    }
);


// ============================================================
// 22. アプリ起動
// ============================================================

async function initializeApp() {

    try {

        // room_id取得
        roomId =
            getRoomId();


        // room表示
        renderRoomId();


        // ボタン有効化
        setButtonsDisabled(
            false
        );


        // room取得 / 作成
        await fetchRoom();


        // Realtime購読
        subscribeToRoom();


        console.log(
            "アプリ初期化完了"
        );

        console.log(
            "room_id:",
            roomId
        );


    } catch (error) {

        console.error(
            "アプリ初期化エラー:",
            error
        );


        statusCard.classList.remove(
            "ok"
        );

        statusCard.classList.add(
            "ng"
        );

        statusIcon.textContent =
            "⚠️";

        statusText.textContent =
            "状態を取得できません";


        remainingTime.textContent =
            "";


        showMessage(
            "状態の取得に失敗しました",
            "error"
        );


        setButtonsDisabled(
            true
        );
    }
}


// ============================================================
// 23. 起動
// ============================================================

initializeApp();
// ============================================
// 電話OK / NG共有アプリ
// app.js
// ============================================


// ============================================
// 1. Supabase設定
// ============================================

const SUPABASE_URL =
    "https://yazersdyvuhirftxocze.supabase.co/rest/v1/";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_M997uooOd5ovhvCPYWfOAQ_qIUqLBp1";


const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ============================================
// 2. DOM
// ============================================

const statusCard =
    document.getElementById("statusCard");

const statusIcon =
    document.getElementById("statusIcon");

const statusTitle =
    document.getElementById("statusTitle");

const remainingTime =
    document.getElementById("remainingTime");

const expirationText =
    document.getElementById("expirationText");

const roomText =
    document.getElementById("roomText");

const errorMessage =
    document.getElementById("errorMessage");

const connectionStatus =
    document.getElementById("connectionStatus");

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

const copyMessage =
    document.getElementById("copyMessage");


// ============================================
// 3. room_id取得
// ============================================

function getRoomId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    let roomId =
        params.get("room");


    // roomが存在しない場合
    if (!roomId) {

        roomId =
            crypto.randomUUID();

        const newUrl =
            `${window.location.origin}${window.location.pathname}?room=${roomId}`;

        window.history.replaceState(
            {},
            "",
            newUrl
        );
    }

    return roomId;
}


const roomId = getRoomId();

roomText.textContent =
    `Room: ${roomId}`;


// ============================================
// 4. room_idのバリデーション
// ============================================

function isValidRoomId(roomId) {

    if (!roomId) {
        return false;
    }

    // UUIDまたは英数字・ハイフンのみ
    return /^[a-zA-Z0-9_-]{1,100}$/.test(roomId);
}


if (!isValidRoomId(roomId)) {

    showError(
        "URLのroom情報が正しくありません"
    );

    disableControls();
}


// ============================================
// 5. 現在のroom状態
// ============================================

let currentRoom = null;

let countdownTimer = null;


// ============================================
// 6. 初期化
// ============================================

async function initialize() {

    if (!isValidRoomId(roomId)) {
        return;
    }


    try {

        setConnectionStatus(
            "● 接続中..."
        );


        // ------------------------------------
        // room取得
        // ------------------------------------

        const {
            data,
            error
        } = await supabaseClient
            .from("rooms")
            .select("*")
            .eq("room_id", roomId)
            .maybeSingle();


        if (error) {

            console.error(
                "room取得エラー:",
                error
            );

            throw error;
        }


        // ------------------------------------
        // roomが存在しない
        // ------------------------------------

        if (!data) {

            const {
                error: insertError
            } = await supabaseClient
                .from("rooms")
                .insert({
                    room_id: roomId,
                    status: "ng",
                    expires_at: null
                });


            // 同時アクセスによる
            // unique conflictは再取得すればOK
            if (
                insertError &&
                insertError.code !== "23505"
            ) {

                console.error(
                    "room作成エラー:",
                    insertError
                );

                throw insertError;
            }


            // 作成後に取得
            const {
                data: createdRoom,
                error: fetchError
            } = await supabaseClient
                .from("rooms")
                .select("*")
                .eq("room_id", roomId)
                .single();


            if (fetchError) {

                console.error(
                    "作成room取得エラー:",
                    fetchError
                );

                throw fetchError;
            }


            currentRoom =
                createdRoom;

        } else {

            currentRoom =
                data;
        }


        // ------------------------------------
        // 表示
        // ------------------------------------

        renderRoom(
            currentRoom
        );


        // ------------------------------------
        // Realtime
        // ------------------------------------

        setupRealtime();


        setConnectionStatus(
            "● 接続中"
        );


    } catch (error) {

        console.error(
            "初期化エラー:",
            error
        );

        showError(
            "状態の取得に失敗しました"
        );

        setConnectionStatus(
            "● 接続エラー"
        );
    }
}


// ============================================
// 7. 状態表示
// ============================================

function renderRoom(room) {

    currentRoom =
        room;


    hideError();


    if (
        room.status === "ok" &&
        room.expires_at
    ) {

        renderOk(room);

    } else {

        renderNg();
    }
}


// ============================================
// 8. OK表示
// ============================================

function renderOk(room) {

    statusCard.classList.remove(
        "status-ng"
    );

    statusCard.classList.add(
        "status-ok"
    );


    statusIcon.textContent =
        "🟢";


    statusTitle.textContent =
        "電話してOK";


    remainingTime.classList.remove(
        "hidden"
    );


    expirationText.classList.remove(
        "hidden"
    );


    startCountdown(
        room.expires_at
    );
}


// ============================================
// 9. NG表示
// ============================================

function renderNg() {

    stopCountdown();


    statusCard.classList.remove(
        "status-ok"
    );

    statusCard.classList.add(
        "status-ng"
    );


    statusIcon.textContent =
        "🔴";


    statusTitle.textContent =
        "今は電話できません";


    remainingTime.classList.add(
        "hidden"
    );


    expirationText.classList.add(
        "hidden"
    );
}


// ============================================
// 10. カウントダウン
// ============================================

function startCountdown(
    expiresAt
) {

    stopCountdown();


    function update() {

        const now =
            Date.now();

        const expires =
            new Date(
                expiresAt
            ).getTime();


        const diff =
            expires - now;


        if (diff <= 0) {

            remainingTime.textContent =
                "まもなく自動的にNGになります";


            expirationText.textContent =
                "";


            // サーバー側にもNG化を要求
            expireRoomImmediately();

            return;
        }


        remainingTime.textContent =
            `あと ${formatRemainingTime(diff)}`;


        const expirationDate =
            new Date(expiresAt);


        expirationText.textContent =
            `有効期限: ${formatDateTime(expirationDate)}`;
    }


    update();


    countdownTimer =
        setInterval(
            update,
            1000
        );
}


// ============================================
// 11. カウントダウン停止
// ============================================

function stopCountdown() {

    if (countdownTimer !== null) {

        clearInterval(
            countdownTimer
        );

        countdownTimer =
            null;
    }
}


// ============================================
// 12. 残り時間フォーマット
// ============================================

function formatRemainingTime(
    milliseconds
) {

    let totalSeconds =
        Math.ceil(
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


    if (hours >= 1) {

        return `${hours}時間${minutes}分${seconds}秒`;

    }


    if (minutes >= 1) {

        return `${minutes}分${seconds}秒`;

    }


    return `${seconds}秒`;
}


// ============================================
// 13. 日時表示
// ============================================

function formatDateTime(
    date
) {

    return date.toLocaleString(
        "ja-JP",
        {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );
}


// ============================================
// 14. 電話OKボタン
// ============================================

okButton.addEventListener(
    "click",
    async () => {

        await setPhoneOk();

    }
);


async function setPhoneOk() {

    hideError();


    const hours =
        Number(
            hoursInput.value
        );

    const minutes =
        Number(
            minutesInput.value
        );


    // ------------------------------------
    // 入力チェック
    // ------------------------------------

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes)
    ) {

        showError(
            "時間と分を正しく入力してください"
        );

        return;
    }


    if (
        hours < 0 ||
        hours > 23
    ) {

        showError(
            "時間は0〜23時間で入力してください"
        );

        return;
    }


    if (
        minutes < 0 ||
        minutes > 59
    ) {

        showError(
            "分は0〜59分で入力してください"
        );

        return;
    }


    const totalMinutes =
        hours * 60 + minutes;


    if (totalMinutes <= 0) {

        showError(
            "1分以上を指定してください"
        );

        return;
    }


    // 最大24時間
    if (totalMinutes > 24 * 60) {

        showError(
            "電話OKの時間は24時間以内で指定してください"
        );

        return;
    }


    setButtonsDisabled(
        true
    );


    try {

        // --------------------------------
        // ブラウザ時刻ではなく
        // Supabase DB時刻を基準にする
        // --------------------------------

        const expiresAt =
            new Date(
                Date.now() +
                totalMinutes * 60 * 1000
            ).toISOString();


        const {
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
            );


        if (error) {

            console.error(
                "OK更新エラー:",
                error
            );

            throw error;
        }


        // 自分の画面も即時更新
        renderRoom({
            room_id: roomId,
            status: "ok",
            expires_at: expiresAt
        });


    } catch (error) {

        console.error(
            error
        );

        showError(
            "電話OKへの変更に失敗しました"
        );

    } finally {

        setButtonsDisabled(
            false
        );
    }
}


// ============================================
// 15. NGボタン
// ============================================

ngButton.addEventListener(
    "click",
    async () => {

        await setPhoneNg();

    }
);


async function setPhoneNg() {

    hideError();

    setButtonsDisabled(
        true
    );


    try {

        const {
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
            );


        if (error) {

            console.error(
                "NG更新エラー:",
                error
            );

            throw error;
        }


        renderNg();


    } catch (error) {

        console.error(
            error
        );

        showError(
            "電話NGへの変更に失敗しました"
        );

    } finally {

        setButtonsDisabled(
            false
        );
    }
}


// ============================================
// 16. 期限到達時の即時NG
// ============================================

let expirationRequestInProgress =
    false;


async function expireRoomImmediately() {

    if (
        expirationRequestInProgress
    ) {
        return;
    }


    expirationRequestInProgress =
        true;


    try {

        const {
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
            .eq(
                "status",
                "ok"
            );


        if (error) {

            console.error(
                "期限切れ処理エラー:",
                error
            );
        }


    } catch (error) {

        console.error(
            error
        );

    } finally {

        expirationRequestInProgress =
            false;
    }
}


// ============================================
// 17. Realtime
// ============================================

let realtimeChannel =
    null;


function setupRealtime() {

    if (realtimeChannel) {

        supabaseClient.removeChannel(
            realtimeChannel
        );
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
                (payload) => {

                    console.log(
                        "Realtime update:",
                        payload
                    );


                    if (
                        payload.new.room_id !== roomId
                    ) {

                        return;
                    }


                    renderRoom(
                        payload.new
                    );
                }
            )
            .subscribe(
                (status) => {

                    console.log(
                        "Realtime status:",
                        status
                    );


                    if (
                        status === "SUBSCRIBED"
                    ) {

                        setConnectionStatus(
                            "● リアルタイム接続中"
                        );

                    }


                    if (
                        status === "CHANNEL_ERROR" ||
                        status === "TIMED_OUT"
                    ) {

                        setConnectionStatus(
                            "● リアルタイム接続エラー"
                        );

                    }


                    if (
                        status === "CLOSED"
                    ) {

                        setConnectionStatus(
                            "● 接続終了"
                        );
                    }
                }
            );
}


// ============================================
// 18. URLコピー
// ============================================

copyButton.addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(
                window.location.href
            );


            copyMessage.classList.remove(
                "hidden"
            );


            setTimeout(
                () => {

                    copyMessage.classList.add(
                        "hidden"
                    );

                },
                2000
            );


        } catch (error) {

            console.error(
                "URLコピーエラー:",
                error
            );


            // Clipboard APIが使えない場合
            fallbackCopyUrl();
        }
    }
);


function fallbackCopyUrl() {

    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.value =
        window.location.href;


    document.body.appendChild(
        textarea
    );


    textarea.select();


    try {

        document.execCommand(
            "copy"
        );

        copyMessage.textContent =
            "URLをコピーしました";

        copyMessage.classList.remove(
            "hidden"
        );


        setTimeout(
            () => {

                copyMessage.classList.add(
                    "hidden"
                );

            },
            2000
        );

    } catch (error) {

        console.error(
            "コピー失敗:",
            error
        );

        showError(
            "URLをコピーできませんでした"
        );

    }


    document.body.removeChild(
        textarea
    );
}


// ============================================
// 19. エラー表示
// ============================================

function showError(
    message
) {

    errorMessage.textContent =
        message;

    errorMessage.classList.remove(
        "hidden"
    );
}


function hideError() {

    errorMessage.classList.add(
        "hidden"
    );
}


// ============================================
// 20. 接続状態
// ============================================

function setConnectionStatus(
    text
) {

    connectionStatus.textContent =
        text;
}


// ============================================
// 21. ボタン制御
// ============================================

function setButtonsDisabled(
    disabled
) {

    okButton.disabled =
        disabled;

    ngButton.disabled =
        disabled;
}


function disableControls() {

    okButton.disabled =
        true;

    ngButton.disabled =
        true;

    copyButton.disabled =
        true;
}


// ============================================
// 22. 初期化
// ============================================

initialize();
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, updateDoc, increment, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. الإعدادات (نفسها)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDB9i7E-Fnc3rofzWVw4Q5--DWapBtbYYo",
    authDomain: "khodmadz-c831d.firebaseapp.com",
    projectId: "khodmadz-c831d",
    storageBucket: "khodmadz-c831d.firebasestorage.app",
    messagingSenderId: "504971684926",
    appId: "1:504971684926:web:d49adc6e08b5fb7dcb356f",
    measurementId: "G-D8KKZ46YSS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAIL = "ammarcharef2006@gmail.com"; 

let currentUser = null;
let currentBalance = 0;
let isBanned = false; // حالة الحظر

// متغيرات كشف الاحتيال
let lastClickTime = 0;
let clickCount = 0;

window.addEventListener('load', () => setTimeout(() => document.getElementById('loader').classList.add('hidden'), 1000));

// ==========================================
// 2. نظام الأمن والحماية (Anti-Fraud System) 🛡️
// ==========================================
async function checkFraudStatus(user) {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);
    
    if (snapshot.exists()) {
        const data = snapshot.data();
        
        // 1. التحقق من الحظر
        if (data.banned === true) {
            isBanned = true;
            Swal.fire({
                icon: 'error',
                title: 'حساب محظور',
                text: 'تم حظر حسابك بسبب انتهاك سياسة الاستخدام (غش أو VPN).',
                allowOutsideClick: false,
                showConfirmButton: false
            });
            return false;
        }

        // 2. التحقق من تعدد الحسابات (بصمة الجهاز)
        const deviceID = localStorage.getItem('device_id') || generateDeviceID();
        if (data.deviceID && data.deviceID !== deviceID) {
            // محاولة دخول من جهاز آخر أو جهاز واحد بحسابين
            // (يمكنك تفعيل الحظر هنا، لكن سنكتفي بالتحذير حالياً)
        }
        
        // تحديث بصمة الجهاز إذا لم تكن موجودة
        if (!data.deviceID) {
            await updateDoc(userRef, { deviceID: deviceID });
            localStorage.setItem('device_id', deviceID);
        }
    }
    return true;
}

function generateDeviceID() {
    // إنشاء معرف فريد للجهاز وتخزينه
    const id = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('device_id', id);
    return id;
}

// كشف VPN بسيط (عن طريق التوقيت)
function detectVPN() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // إذا لم يكن التوقيت متوافقاً مع الجزائر (أو منطقتك المستهدفة)
    // ملاحظة: هذا تحقق بسيط، التحقق القوي يحتاج API خارجي مدفوع
    // console.log("User Timezone:", timezone); 
    return false; // نتركها false حالياً لتجنب حظر الخطأ في البداية
}

// ==========================================
// 3. الدخول والبيانات
// ==========================================
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(e => Swal.fire('خطأ', e.message, 'error'));
};

window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // التحقق الأمني أولاً
        const isSafe = await checkFraudStatus(user);
        if (!isSafe) return; // إيقاف التشغيل للمحظورين

        currentUser = user;
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-dashboard').classList.remove('hidden');
        document.getElementById('user-nav').classList.remove('hidden');
        
        if (user.email === ADMIN_EMAIL) document.getElementById('admin-btn').classList.remove('hidden');

        await syncBalance();
    }
});

async function syncBalance() {
    if(!currentUser || isBanned) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        currentBalance = userSnap.data().balance || 0;
    } else {
        await setDoc(userRef, { 
            email: currentUser.email, 
            balance: 0,
            deviceID: localStorage.getItem('device_id') || generateDeviceID(),
            banned: false
        });
        currentBalance = 0;
    }
    
    document.querySelectorAll('#header-balance, #wallet-balance').forEach(el => {
        el.innerText = currentBalance.toFixed(2);
    });
}

// ==========================================
// 4. المشاهدة والربح (مع حماية التكرار)
// ==========================================
window.watchAd = (reward, seconds) => {
    if (isBanned) return;

    // A. حماية النقر السريع (Bot Protection)
    const now = Date.now();
    if (now - lastClickTime < 2000) { // ضغطتين في أقل من ثانيتين
        Swal.fire('تمهل!', 'أنت تضغط بسرعة كبيرة، هذا سلوك روبوت.', 'warning');
        return;
    }
    lastClickTime = now;

    // B. كشف الـ VPN
    if (detectVPN()) {
        Swal.fire('تحذير', 'يرجى إغلاق الـ VPN لاستخدام الموقع', 'error');
        return;
    }

    let timerInterval;
    Swal.fire({
        title: 'شاهد الإعلان',
        html: `انتظر <b>${seconds}</b> ثانية... <br><span style="font-size:12px;color:red">لا تغادر الصفحة</span>`,
        timer: seconds * 1000,
        timerProgressBar: true,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            const b = Swal.getHtmlContainer().querySelector('b');
            timerInterval = setInterval(() => {
                b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
            }, 100);
            
            // C. حماية التركيز (Focus Protection)
            // إذا غادر المستخدم التبويب، يوقف العداد
            window.onblur = () => {
                Swal.close();
                Swal.fire('خطأ', 'يجب أن تبقى في صفحة الإعلان!', 'error');
                clearInterval(timerInterval);
            };
        },
        willClose: () => {
            clearInterval(timerInterval);
            window.onblur = null; // إزالة مراقب التركيز
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.timer) {
            addBalanceToUser(reward, "مشاهدة إعلان");
        }
    });
};

window.simulateCPA = (reward) => {
    if (isBanned) return;
    Swal.fire({
        title: 'جاري التحقق...',
        text: 'يتم فحص IP الخاص بك...',
        timer: 3000,
        didOpen: () => Swal.showLoading()
    }).then(() => {
        addBalanceToUser(reward, "إكمال عرض CPA");
    });
};

async function addBalanceToUser(amount, type) {
    if (isBanned) return;

    // D. حماية السقف اليومي (Daily Cap) - اختياري
    // لمنع شخص من جمع مليون دينار في يوم واحد
    if (currentBalance > 5000) { // مثال: الحد الأقصى للمحفظة
        return Swal.fire('تنبيه', 'وصلت للحد الأقصى للمحفظة، يرجى السحب أولاً.', 'info');
    }

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { balance: increment(amount) });
        
        await addDoc(collection(db, "transactions"), {
            userId: currentUser.uid,
            amount: amount,
            type: "earning",
            source: type,
            ip: "captured_in_backend", // يمكن تخزين IP هنا
            date: new Date().toISOString()
        });

        await syncBalance();
        
        Swal.fire({
            icon: 'success',
            title: `+${amount} دج`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500
        });

    } catch (e) {
        console.error(e);
        // إذا فشل التحديث بسبب قواعد الأمان (مثلاً محاولة اختراق)، نحظره
        // banUser(currentUser.uid);
    }
}

// ==========================================
// 5. السحب والإدارة
// ==========================================
window.requestWithdraw = async () => {
    if (isBanned) return;
    if (currentBalance < 500) return Swal.fire('الرصيد غير كاف', 'الحد الأدنى للسحب هو 500 دج', 'warning');

    const { value: formValues } = await Swal.fire({
        title: 'سحب الرصيد',
        html:
            '<select id="w-method" class="swal2-input"><option value="Baridimob">Baridimob</option><option value="Flexy">Flexy</option></select>' +
            '<input id="w-info" class="swal2-input" placeholder="رقم الهاتف / RIP">',
        focusConfirm: false,
        preConfirm: () => [document.getElementById('w-method').value, document.getElementById('w-info').value]
    });

    if (formValues) {
        const [method, info] = formValues;
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { balance: increment(-currentBalance) });
            await addDoc(collection(db, "withdrawals"), {
                userId: currentUser.uid,
                email: currentUser.email,
                amount: currentBalance,
                method, info,
                status: "processing",
                date: new Date().toISOString()
            });
            await syncBalance();
            Swal.fire('تم', 'طلبك قيد المراجعة الأمنية.', 'success');
        } catch(e) { Swal.fire('خطأ', e.message, 'error'); }
    }
};

// لوحة المدير
window.loadAdminWithdrawals = async () => {
    const list = document.getElementById('admin-withdraw-list');
    list.innerHTML = 'جاري التحميل...';
    const q = query(collection(db, "withdrawals"), where("status", "==", "processing"));
    const snap = await getDocs(q);
    list.innerHTML = snap.empty ? '<p>لا توجد طلبات.</p>' : '';

    snap.forEach(d => {
        const data = d.data();
        list.innerHTML += `
            <div class="border p-3 flex justify-between items-center bg-gray-50 mb-2">
                <div>
                    <div class="font-bold text-lg">${data.amount} دج</div>
                    <div class="text-sm">${data.method}: ${data.info}</div>
                    <div class="text-xs text-gray-400">${data.email}</div>
                </div>
                <div>
                    <button onclick="banUser('${data.userId}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs ml-2">حظر (غشاش)</button>
                    <button onclick="markPaid('${d.id}')" class="bg-green-600 text-white px-4 py-2 rounded text-sm">تم التحويل</button>
                </div>
            </div>`;
    });
};

window.markPaid = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
    window.loadAdminWithdrawals();
    Swal.fire('تم', 'تم الدفع', 'success');
};

// دالة حظر المستخدم (Admin Only)
window.banUser = async (userId) => {
    if(!confirm('هل أنت متأكد من حظر هذا المستخدم نهائياً؟')) return;
    try {
        await updateDoc(doc(db, "users", userId), { banned: true });
        Swal.fire('تم الحظر', 'لن يتمكن هذا المستخدم من الدخول مرة أخرى', 'success');
        window.loadAdminWithdrawals(); // تحديث القائمة
    } catch(e) { console.error(e); }
};
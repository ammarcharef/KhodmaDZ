// استيراد مكتبات فايربيس
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, onSnapshot, query, where, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================
// 1. إعدادات الاتصال (ضع بياناتك هنا)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDB9i7E-Fnc3rofzWVw4Q5--DWapBtbYYo",
    authDomain: "khodmadz-c831d.firebaseapp.com",
    projectId: "khodmadz-c831d",
    storageBucket: "khodmadz-c831d.firebasestorage.app",
    messagingSenderId: "504971684926",
    appId: "1:504971684926:web:d49adc6e08b5fb7dcb356f",
    measurementId: "G-D8KKZ46YSS"
  };

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let exchangeRate = 134; // سعر افتراضي أولي

// ============================================================
// 2. نظام العملة وسعر الصرف الآلي
// ============================================================
async function fetchExchangeRate() {
    try {
        // نستخدم API مجاني لجلب سعر الدولار مقابل الدينار
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        const officialRate = data.rates.DZD; 
        
        // تعديل السعر ليناسب السوق الموازي (تقريبي) أو نعتمد الرسمي حسب اختيارك
        // هنا سأعتمد الرسمي للدقة، يمكنك ضربه في معامل (مثلاً * 1.5) للسوق السوداء
        exchangeRate = officialRate; 
        
        document.getElementById('exchange-rate-display').innerText = `سعر الصرف العالمي: 1 USD = ${exchangeRate.toFixed(2)} DZD`;
        document.getElementById('dash-rate').innerText = `${exchangeRate.toFixed(2)} DZD`;
    } catch (error) {
        console.error("فشل جلب سعر الصرف", error);
    }
}
fetchExchangeRate();

// ============================================================
// 3. المصادقة (تسجيل الدخول)
// ============================================================
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("تم الدخول:", result.user);
            // هنا يجب إنشاء مستند للمستخدم في قاعدة البيانات إذا كان جديداً
        }).catch((error) => console.error(error));
};

window.logout = () => {
    signOut(auth).then(() => location.reload());
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('login-btn').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        loadTasks();
        // جلب رصيد المستخدم (مبسط)
        document.getElementById('dash-balance').innerText = "0.00 DZD"; // يحتاج ربط بقاعدة البيانات
    }
});

// ============================================================
// 4. نظام المهام والفلترة الآلية (جوهر المشروع)
// ============================================================

// قائمة الكلمات المحظورة (فلترة آلية)
const bannedWords = ["قمار", "bet", "1xbet", "poker", "عاري", "مواعدة", "dating", "casino", "music", "أغاني", "فوائد", "قرض"];

window.addTask = async () => {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const reward = parseFloat(document.getElementById('task-reward').value);

    // 1. الفلترة الآلية
    const content = (title + " " + desc).toLowerCase();
    const hasBannedWord = bannedWords.some(word => content.includes(word));

    if (hasBannedWord) {
        alert("⚠️ تم رفض المهمة آلياً: تحتوي على كلمات مخالفة للشريعة أو سياسة الموقع.");
        return;
    }

    if (!currentUser) return alert("سجل دخولك أولاً");

    try {
        await addDoc(collection(db, "tasks"), {
            title: title,
            description: desc,
            reward: reward,
            advertiser: currentUser.uid,
            createdAt: new Date(),
            status: "active"
        });
        alert("تم نشر المهمة بنجاح! سيتم خصم المبلغ من رصيدك (محاكاة).");
        loadTasks();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("حدث خطأ");
    }
};

async function loadTasks() {
    const q = query(collection(db, "tasks"), where("status", "==", "active"));
    const querySnapshot = await getDocs(q);
    const container = document.getElementById('tasks-container');
    container.innerHTML = "";

    querySnapshot.forEach((doc) => {
        const task = doc.data();
        const html = `
            <div class="bg-white p-4 rounded shadow border border-gray-200">
                <h4 class="font-bold text-lg text-emerald-700">${task.title}</h4>
                <p class="text-sm text-gray-600 mb-2">${task.description}</p>
                <div class="flex justify-between items-center mt-4">
                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-bold">${task.reward} DZD</span>
                    <button onclick="doTask('${doc.id}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">تنفيذ</button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

window.doTask = (taskId) => {
    // هنا تظهر نافذة رفع سكرين شوت
    const proof = prompt("أدخل رابط الصورة (سكرين شوت) لإثبات التنفيذ:");
    if (proof) {
        alert("تم إرسال الإثبات للمراجعة. ستضاف الأرباح بعد الموافقة.");
    }
};

// ============================================================
// 5. نظام السحب
// ============================================================
window.requestWithdraw = () => {
    const method = document.getElementById('withdraw-method').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    // التحقق من الحد الأدنى
    if (method === 'flexy' && amount < 500) return alert("الحد الأدنى للفليكسي هو 500 دج");
    if (method === 'baridimob' && amount < 2000) return alert("الحد الأدنى لبريدي موب هو 2000 دج");

    // التحقق من الرصيد (محاكاة)
    // if (userBalance < amount) return alert("رصيدك غير كاف");

    alert(`تم استلام طلب سحب ${amount} DZD عبر ${method}. سيتم التحويل خلال 24 ساعة.`);
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, updateDoc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. إعدادات المشروع (مفاتيحك الحقيقية)
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

// البريد الإلكتروني للمدير (أنت)
const ADMIN_EMAIL = "ammarcharef2006@gmail.com"; 

let currentUser = null;
let exchangeRate = 134; 

// ==========================================
// 2. إدارة المستخدم وتسجيل الدخول (الدمج المصحح)
// ==========================================
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider)
        .then((result) => console.log("Logged in"))
        .catch((error) => console.error(error));
};

window.logout = () => {
    signOut(auth).then(() => location.reload());
};

// المراقب الموحد (Unified Listener)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // إظهار واجهة المستخدم
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('login-btn').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        
        loadTasks(); // تحميل المهام

        // هل هذا المستخدم هو المدير؟
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('admin-dashboard').classList.remove('hidden');
            loadAdminData(); // تشغيل بيانات المدير
        }
    } else {
        currentUser = null;
    }
});

// ==========================================
// 3. سعر الصرف
// ==========================================
async function fetchExchangeRate() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        exchangeRate = data.rates.DZD; 
        document.getElementById('exchange-rate-display').innerText = `سعر الصرف العالمي: 1 USD = ${exchangeRate.toFixed(2)} DZD`;
        document.getElementById('dash-rate').innerText = `${exchangeRate.toFixed(2)} DZD`;
    } catch (e) { console.error(e); }
}
fetchExchangeRate();

// ==========================================
// 4. المهام (إضافة وتنفيذ)
// ==========================================
const bannedWords = ["قمار", "bet", "1xbet", "poker", "عاري", "مواعدة", "dating", "casino", "music", "أغاني", "فوائد", "قرض"];

window.addTask = async () => {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const reward = parseFloat(document.getElementById('task-reward').value);

    // فلترة
    const content = (title + " " + desc).toLowerCase();
    if (bannedWords.some(word => content.includes(word))) {
        return alert("⚠️ تم رفض المهمة آلياً: محتوى مخالف.");
    }
    if (!currentUser) return alert("سجل دخولك أولاً");

    try {
        await addDoc(collection(db, "tasks"), {
            title: title,
            description: desc,
            reward: reward,
            advertiser: currentUser.uid,
            status: "active",
            createdAt: new Date().toISOString()
        });
        alert("تم نشر المهمة!");
        loadTasks();
    } catch (e) { alert("خطأ: " + e.message); }
};

async function loadTasks() {
    const q = query(collection(db, "tasks"), where("status", "==", "active"));
    const querySnapshot = await getDocs(q);
    const container = document.getElementById('tasks-container');
    container.innerHTML = "";

    querySnapshot.forEach((doc) => {
        const task = doc.data();
        container.innerHTML += `
            <div class="bg-white p-4 rounded shadow border border-gray-200">
                <h4 class="font-bold text-lg text-emerald-700">${task.title}</h4>
                <p class="text-sm text-gray-600 mb-2">${task.description}</p>
                <div class="flex justify-between items-center mt-4">
                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-bold">${task.reward} DZD</span>
                    <button onclick="doTask('${doc.id}', '${task.title}', ${task.reward})" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">تنفيذ</button>
                </div>
            </div>`;
    });
}

// تنفيذ المهمة (أصبح الآن يحفظ في الداتا بيس)
window.doTask = async (taskId, taskTitle, reward) => {
    const proofLink = prompt("أدخل رابط صورة الإثبات (سكرين شوت):");
    if (!proofLink) return;

    try {
        // حفظ الإثبات في مجموعة جديدة اسمها proofs
        await addDoc(collection(db, "proofs"), {
            taskId: taskId,
            taskTitle: taskTitle,
            workerEmail: currentUser.email,
            workerId: currentUser.uid,
            proof: proofLink,
            reward: reward,
            status: "pending" // ينتظر مراجعتك
        });
        alert("تم إرسال الإثبات للمراجعة! سيظهر الرصيد بعد موافقة المدير.");
    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء الإرسال");
    }
};

// ==========================================
// 5. السحب (أصبح يحفظ في الداتا بيس)
// ==========================================
window.requestWithdraw = async () => {
    const method = document.getElementById('withdraw-method').value;
    const info = document.getElementById('withdraw-info').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    if (method === 'flexy' && amount < 500) return alert("أقل مبلغ للفليكسي 500");
    if (method === 'baridimob' && amount < 2000) return alert("أقل مبلغ لبريدي موب 2000");

    try {
        await addDoc(collection(db, "withdrawals"), {
            userEmail: currentUser.email,
            method: method,
            info: info,
            amount: amount,
            status: "pending",
            date: new Date().toISOString()
        });
        alert("تم إرسال طلب السحب للمدير!");
    } catch (e) { alert("خطأ: " + e.message); }
};

// ==========================================
// 6. لوحة المدير (الذكية والحقيقية)
// ==========================================
async function loadAdminData() {
    // A. جلب الإثباتات (Proofs)
    const proofsContainer = document.getElementById('admin-proofs-list');
    const qProofs = query(collection(db, "proofs"), where("status", "==", "pending"));
    const proofsSnap = await getDocs(qProofs);
    
    proofsContainer.innerHTML = "";
    if(proofsSnap.empty) proofsContainer.innerHTML = "<p class='text-gray-500'>لا توجد إثباتات جديدة.</p>";

    proofsSnap.forEach(docSnap => {
        const p = docSnap.data();
        proofsContainer.innerHTML += `
            <div class="bg-gray-700 p-3 rounded mb-2 text-sm">
                <p class="font-bold text-yellow-400">مهمة: ${p.taskTitle}</p>
                <p>العامل: ${p.workerEmail}</p>
                <p>الإثبات: <a href="${p.proof}" target="_blank" class="text-blue-300 underline">رابط الصورة</a></p>
                <div class="mt-2 flex gap-2">
                    <button onclick="approveTask('${docSnap.id}', '${p.workerId}', ${p.reward})" class="bg-green-600 px-2 py-1 rounded">قبول ودفع ${p.reward}</button>
                    <button onclick="rejectProof('${docSnap.id}')" class="bg-red-600 px-2 py-1 rounded">رفض</button>
                </div>
            </div>`;
    });

    // B. جلب طلبات السحب (Withdrawals)
    const withdrawContainer = document.getElementById('admin-withdrawals-list');
    const qWithdraw = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    const withdrawSnap = await getDocs(qWithdraw);

    withdrawContainer.innerHTML = "";
    if(withdrawSnap.empty) withdrawContainer.innerHTML = "<p class='text-gray-500'>لا توجد طلبات سحب.</p>";

    withdrawSnap.forEach(docSnap => {
        const w = docSnap.data();
        withdrawContainer.innerHTML += `
            <div class="bg-gray-700 p-3 rounded mb-2 text-sm border-l-4 border-blue-500">
                <p class="font-bold">${w.userEmail}</p>
                <p class="text-xl font-bold text-white">${w.amount} DZD</p>
                <p class="text-gray-300">عبر: ${w.method} | معلومات: ${w.info}</p>
                <button onclick="markWithdrawDone('${docSnap.id}')" class="mt-2 w-full bg-blue-600 hover:bg-blue-700 py-1 rounded">تم التحويل يدوياً</button>
            </div>`;
    });
}

// دوال المدير المساعدة (Make global so HTML can see them)
window.approveTask = async (proofId, workerId, reward) => {
    if(!confirm("هل أنت متأكد من قبول المهمة ودفع المال؟")) return;
    try {
        // 1. تحديث حالة الإثبات
        await updateDoc(doc(db, "proofs", proofId), { status: "approved" });
        // 2. (اختياري) هنا يمكن إضافة كود لزيادة رصيد المستخدم في قاعدة البيانات
        // لكن للتبسيط سنحذف الطلب من القائمة فقط الآن
        alert(`تم قبول المهمة! يجب عليك يدوياً تذكر أن ${workerId} يستحق ${reward} دج`);
        loadAdminData(); // تحديث القائمة
    } catch(e) { console.error(e); }
};

window.rejectProof = async (proofId) => {
    await updateDoc(doc(db, "proofs", proofId), { status: "rejected" });
    loadAdminData();
};

window.markWithdrawDone = async (withdrawId) => {
    if(!confirm("هل قمت بتحويل المال له حقاً؟")) return;
    await updateDoc(doc(db, "withdrawals", withdrawId), { status: "completed" });
    loadAdminData();
};
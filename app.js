import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ⚠️ إيميل المدير (أنت)
const ADMIN_EMAIL = "ammarcharef2006@gmail.com"; 

let currentUser = null;

// إخفاء شاشة التحميل عند البدء
window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 1000);
});

// ==========================================
// 2. المصادقة
// ==========================================
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch((error) => {
        Swal.fire('خطأ', error.message, 'error');
    });
};

window.logout = () => {
    Swal.fire({
        title: 'تسجيل الخروج؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) signOut(auth).then(() => location.reload());
    });
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // إظهار الواجهة
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-dashboard').classList.remove('hidden');
        document.getElementById('user-nav').classList.remove('hidden');
        
        // جلب البيانات
        loadTasks();
        
        // التحقق من المدير
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('admin-btn').classList.remove('hidden');
        }
    } else {
        currentUser = null;
    }
});

// ==========================================
// 3. إدارة المهام (User Side)
// ==========================================
window.loadTasks = async () => {
    const container = document.getElementById('tasks-grid');
    container.innerHTML = '<div class="col-span-3 text-center py-10"><i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-600"></i></div>';
    
    try {
        const q = query(collection(db, "tasks"), where("status", "==", "active"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        container.innerHTML = "";
        if (querySnapshot.empty) {
            container.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-10">لا توجد مهام متاحة حالياً. كن أول من ينشر!</div>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const task = doc.data();
            container.innerHTML += `
                <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 p-4 flex flex-col justify-between h-full">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-lg">مهمة نشطة</span>
                            <span class="font-bold text-lg text-emerald-600">${task.reward} دج</span>
                        </div>
                        <h4 class="font-bold text-gray-800 mb-1 line-clamp-1">${task.title}</h4>
                        <p class="text-sm text-gray-500 mb-4 line-clamp-2">${task.description}</p>
                    </div>
                    <button onclick="startTask('${doc.id}', '${task.title}', ${task.reward})" class="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition">
                        <i class="fa-solid fa-play ml-1"></i> تنفيذ المهمة
                    </button>
                </div>`;
        });
    } catch (e) { console.error(e); }
};

window.handleAddTask = async () => {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const reward = parseFloat(document.getElementById('task-reward').value);
    
    if(!title || !desc || !reward) return Swal.fire('تنبيه', 'يرجى ملء جميع الحقول', 'warning');
    
    // فلترة بسيطة
    const forbidden = ["قمار", "1xbet", "sex", "عاري", "مراهنات", "ربا"];
    if (forbidden.some(w => (title+desc).toLowerCase().includes(w))) {
        return Swal.fire('مرفوض', 'المحتوى يخالف الشريعة الإسلامية', 'error');
    }

    try {
        await addDoc(collection(db, "tasks"), {
            title, description: desc, reward,
            advertiser: currentUser.uid,
            status: "active",
            createdAt: new Date().toISOString()
        });
        Swal.fire('تم النشر', 'تم نشر مهمتك بنجاح!', 'success');
        document.getElementById('task-title').value = ''; 
        loadTasks();
    } catch (e) { Swal.fire('خطأ', e.message, 'error'); }
};

window.startTask = async (taskId, taskTitle, reward) => {
    const { value: url } = await Swal.fire({
        title: 'إثبات التنفيذ',
        input: 'url',
        inputLabel: 'أدخل رابط الصورة (سكرين شوت) التي تثبت عملك',
        inputPlaceholder: 'https://...',
        showCancelButton: true,
        confirmButtonText: 'إرسال للمراجعة',
        cancelButtonText: 'إلغاء'
    });

    if (url) {
        try {
            await addDoc(collection(db, "proofs"), {
                taskId, taskTitle, reward,
                workerEmail: currentUser.email,
                workerId: currentUser.uid,
                proofUrl: url,
                status: "pending",
                createdAt: new Date().toISOString()
            });
            Swal.fire('أحسنت!', 'تم إرسال الإثبات للمدير. سيصلك الرصيد بعد الموافقة.', 'success');
        } catch (e) { Swal.fire('خطأ', 'حدث خطأ ما', 'error'); }
    }
};

// ==========================================
// 4. المحفظة والسحب (Wallet)
// ==========================================
window.openDepositModal = () => {
    Swal.fire({
        title: 'شحن الرصيد',
        html: `
            <div class="text-right">
                <p class="mb-2">1. أرسل المبلغ عبر Baridimob إلى:</p>
                <div class="bg-gray-100 p-2 rounded text-center font-mono font-bold select-all mb-4">007999999999999999</div>
                <p class="mb-2">2. صور الوصل وأرسله إلى الواتساب:</p>
                <a href="https://wa.me/213550000000" target="_blank" class="block bg-green-500 text-white text-center py-2 rounded-lg font-bold"><i class="fa-brands fa-whatsapp"></i> فتح واتساب الإدارة</a>
            </div>
        `,
        showConfirmButton: false
    });
};

window.openWithdrawModal = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'سحب الأرباح',
        html:
            '<select id="swal-method" class="swal2-input"><option value="flexy">Flexy (Min 500)</option><option value="baridimob">Baridimob (Min 2000)</option></select>' +
            '<input id="swal-info" class="swal2-input" placeholder="رقم الهاتف / RIP">' +
            '<input id="swal-amount" type="number" class="swal2-input" placeholder="المبلغ">',
        focusConfirm: false,
        preConfirm: () => {
            return [
                document.getElementById('swal-method').value,
                document.getElementById('swal-info').value,
                document.getElementById('swal-amount').value
            ]
        }
    });

    if (formValues) {
        const [method, info, amount] = formValues;
        if(!info || !amount) return;
        
        try {
            await addDoc(collection(db, "withdrawals"), {
                userEmail: currentUser.email,
                method, info, amount,
                status: "pending",
                date: new Date().toISOString()
            });
            Swal.fire('تم الطلب', 'طلبك قيد المعالجة', 'success');
        } catch(e) { Swal.fire('خطأ', e.message, 'error'); }
    }
};

// ==========================================
// 5. لوحة المدير (Admin Logic)
// ==========================================
window.refreshAdminData = async () => {
    // 1. جلب الإثباتات
    const pList = document.getElementById('admin-proofs-list');
    pList.innerHTML = '<p class="text-gray-500 text-center text-sm">جاري التحميل...</p>';
    
    const qP = query(collection(db, "proofs"), where("status", "==", "pending"));
    const snapP = await getDocs(qP);
    
    document.getElementById('admin-proofs-count').innerText = snapP.size;
    pList.innerHTML = snapP.empty ? '<p class="text-gray-400 text-center">لا توجد مهام للمراجعة</p>' : '';
    
    snapP.forEach(docSnap => {
        const d = docSnap.data();
        pList.innerHTML += `
            <div class="border p-3 rounded bg-gray-50 text-sm">
                <div class="flex justify-between font-bold mb-1">
                    <span class="text-emerald-700">${d.reward} دج</span>
                    <span class="text-gray-600 truncate w-32 text-left">${d.workerEmail}</span>
                </div>
                <p class="text-gray-800 mb-2">${d.taskTitle}</p>
                <div class="flex gap-2">
                    <a href="${d.proofUrl}" target="_blank" class="flex-1 bg-blue-100 text-blue-700 text-center py-1 rounded hover:bg-blue-200">صورة</a>
                    <button onclick="adminAction('approve', '${docSnap.id}')" class="flex-1 bg-green-500 text-white py-1 rounded hover:bg-green-600">قبول</button>
                    <button onclick="adminAction('reject', '${docSnap.id}')" class="flex-1 bg-red-500 text-white py-1 rounded hover:bg-red-600">رفض</button>
                </div>
            </div>`;
    });

    // 2. جلب السحوبات (بنفس الطريقة يمكن إضافتها)
    // للكود المختصر سأكتفي بالإثباتات كمثال، يمكنك تكرار المنطق للسحوبات
};

window.adminAction = async (type, id) => {
    try {
        await updateDoc(doc(db, "proofs", id), { status: type === 'approve' ? 'approved' : 'rejected' });
        const msg = type === 'approve' ? 'تم قبول المهمة' : 'تم الرفض';
        Swal.fire({
            title: msg,
            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, icon: 'success'
        });
        refreshAdminData();
    } catch(e) { Swal.fire('خطأ', e.message, 'error'); }
};
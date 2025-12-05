import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, updateDoc, increment, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. الإعدادات
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

window.addEventListener('load', () => setTimeout(() => document.getElementById('loader').classList.add('hidden'), 1000));

// ==========================================
// 2. الدخول والبيانات
// ==========================================
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(e => Swal.fire('خطأ', e.message, 'error'));
};

window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-dashboard').classList.remove('hidden');
        document.getElementById('user-nav').classList.remove('hidden');
        
        if (user.email === ADMIN_EMAIL) document.getElementById('admin-btn').classList.remove('hidden');

        // جلب رصيد المستخدم الحقيقي من قاعدة البيانات
        await syncBalance();
    }
});

// دالة لجلب الرصيد وتحديثه في الواجهة
async function syncBalance() {
    if(!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        currentBalance = userSnap.data().balance || 0;
    } else {
        // مستخدم جديد، ننشئ له محفظة
        await setDoc(userRef, { email: currentUser.email, balance: 0 });
        currentBalance = 0;
    }
    
    // تحديث الأرقام في الشاشة
    document.querySelectorAll('#header-balance, #wallet-balance').forEach(el => {
        el.innerText = currentBalance.toFixed(2);
    });
}

// ==========================================
// 3. نظام مشاهدة الإعلانات (المحاكاة)
// ==========================================
window.watchAd = (reward, seconds) => {
    let timerInterval;
    Swal.fire({
        title: 'جاري مشاهدة الإعلان...',
        html: `يجب الانتظار <b>${seconds}</b> ثانية`,
        timer: seconds * 1000,
        timerProgressBar: true,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            const b = Swal.getHtmlContainer().querySelector('b');
            timerInterval = setInterval(() => {
                b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
            }, 100);
        },
        willClose: () => {
            clearInterval(timerInterval);
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.timer) {
            // انتهى الوقت، ندفع للمستخدم
            addBalanceToUser(reward, "مشاهدة إعلان");
        }
    });
};

window.simulateCPA = (reward) => {
    // في الواقع هنا نضع Postback URL
    Swal.fire({
        title: 'جاري التحقق من العرض...',
        text: 'قد يستغرق هذا بضع ثواني للتأكد من الشركة المعلنة',
        timer: 3000,
        didOpen: () => Swal.showLoading()
    }).then(() => {
        addBalanceToUser(reward, "إكمال عرض CPA");
    });
};

// الدالة الأساسية لإضافة المال (المصدر يدفع)
async function addBalanceToUser(amount, type) {
    try {
        const userRef = doc(db, "users", currentUser.uid);
        
        // 1. تحديث الرصيد في الداتا بيس
        await updateDoc(userRef, {
            balance: increment(amount)
        });

        // 2. تسجيل العملية
        await addDoc(collection(db, "transactions"), {
            userId: currentUser.uid,
            amount: amount,
            type: "earning",
            source: type,
            date: new Date().toISOString()
        });

        // 3. تحديث الواجهة
        await syncBalance();
        
        Swal.fire({
            icon: 'success',
            title: `+${amount} دج`,
            text: 'تمت إضافة المبلغ لمحفظتك بنجاح!',
            timer: 1500,
            showConfirmButton: false
        });

    } catch (e) {
        console.error(e);
        Swal.fire('خطأ', 'حدث خطأ في الاتصال بالسيرفر', 'error');
    }
}

// ==========================================
// 4. نظام السحب الآلي (طلب المستخدم)
// ==========================================
window.requestWithdraw = async () => {
    if (currentBalance < 500) {
        return Swal.fire('الرصيد غير كاف', 'الحد الأدنى للسحب هو 500 دج', 'warning');
    }

    const { value: formValues } = await Swal.fire({
        title: 'سحب الرصيد',
        html:
            '<select id="w-method" class="swal2-input"><option value="Baridimob">Baridimob</option><option value="Flexy">Flexy</option></select>' +
            '<input id="w-info" class="swal2-input" placeholder="معلومات الدفع (RIP/Phone)">',
        focusConfirm: false,
        preConfirm: () => {
            return [document.getElementById('w-method').value, document.getElementById('w-info').value]
        }
    });

    if (formValues) {
        const [method, info] = formValues;
        
        // خصم الرصيد فوراً (ليبدو تلقائياً)
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { balance: increment(-currentBalance) });
            
            // تسجيل طلب السحب
            await addDoc(collection(db, "withdrawals"), {
                userId: currentUser.uid,
                email: currentUser.email,
                amount: currentBalance,
                method, info,
                status: "processing", // قيد المعالجة الآلية
                date: new Date().toISOString()
            });

            await syncBalance();
            Swal.fire('تم العملية', 'تم إرسال الأموال للمعالجة البنكية. ستصلك رسالة SMS قريباً.', 'success');
        } catch(e) { Swal.fire('خطأ', e.message, 'error'); }
    }
};

// ==========================================
// 5. لوحة المدير (لمشاهدة من يجب الدفع له)
// ==========================================
window.loadAdminWithdrawals = async () => {
    const list = document.getElementById('admin-withdraw-list');
    list.innerHTML = 'جاري التحميل...';
    
    const q = query(collection(db, "withdrawals"), where("status", "==", "processing"));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    if (snap.empty) list.innerHTML = '<p>لا توجد طلبات سحب جديدة.</p>';

    snap.forEach(d => {
        const data = d.data();
        list.innerHTML += `
            <div class="border p-3 flex justify-between items-center bg-gray-50">
                <div>
                    <div class="font-bold text-lg">${data.amount} دج</div>
                    <div class="text-sm text-gray-600">${data.method}: ${data.info}</div>
                    <div class="text-xs text-gray-400">${data.email}</div>
                </div>
                <button onclick="markPaid('${d.id}')" class="bg-green-600 text-white px-4 py-2 rounded">تم التحويل</button>
            </div>
        `;
    });
};

window.markPaid = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
    window.loadAdminWithdrawals();
    Swal.fire('تم', 'تم تعليم الطلب كمدفوع', 'success');
};
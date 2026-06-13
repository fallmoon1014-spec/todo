import './style.css'
import { auth, db } from './firebase.js'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>할 일 관리</h1>
    
    <!-- 인증 섹션 (로그인 전) -->
    <div id="auth-section">
      <div class="auth-forms">
        <!-- 교사 로그인 -->
        <form id="teacher-login-form" class="card">
          <h2>교사 로그인</h2>
          <input type="email" id="teacher-email" placeholder="교사 이메일" required />
          <input type="password" id="teacher-password" placeholder="비밀번호" required />
          <button type="submit">로그인</button>
        </form>

        <!-- 학생 회원가입 -->
        <form id="student-signup-form" class="card">
          <h2>학생 회원가입</h2>
          <input type="email" id="student-email" placeholder="학생 이메일" required />
          <input type="password" id="student-password" placeholder="비밀번호" required />
          <button type="submit">회원가입</button>
        </form>
      </div>
    </div>

    <!-- 할 일 관리 섹션 (로그인 후) -->
    <div id="todo-section" class="card" style="display: none;">
      <div class="header-row">
        <h2>나의 할 일</h2>
        <button id="logout-btn" class="secondary-btn">로그아웃</button>
      </div>
      
      <form id="todo-form" class="todo-form">
        <input type="text" id="todo-input" placeholder="새로운 할 일을 입력하세요..." required />
        <button type="submit">추가</button>
      </form>

      <ul id="todo-list" class="todo-list">
        <!-- 할 일 아이템들이 여기에 추가됩니다 -->
      </ul>
    </div>
  </div>
`

// DOM 엘리먼트 참조
const authSection = document.getElementById('auth-section');
const todoSection = document.getElementById('todo-section');
const teacherLoginForm = document.getElementById('teacher-login-form');
const studentSignupForm = document.getElementById('student-signup-form');
const logoutBtn = document.getElementById('logout-btn');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

let unsubscribeTodos = null;

// Firebase 인증 상태 감지 (로그인/로그아웃 시 자동 실행)
onAuthStateChanged(auth, (user) => {
  if (user) {
    // 로그인 상태
    authSection.style.display = 'none';
    todoSection.style.display = 'block';
    loadTodos(user.uid);
  } else {
    // 로그아웃 상태
    authSection.style.display = 'block';
    todoSection.style.display = 'none';
    if (unsubscribeTodos) {
      unsubscribeTodos(); // 기존 데이터 구독 해제
      unsubscribeTodos = null;
    }
  }
});

// 교사 로그인 처리
teacherLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('teacher-email').value;
  const password = document.getElementById('teacher-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    teacherLoginForm.reset();
  } catch (error) {
    alert('로그인 실패: ' + error.message);
  }
});

// 학생 회원가입 처리
studentSignupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('student-email').value;
  const password = document.getElementById('student-password').value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert('회원가입 성공! 이제 할 일을 추가해보세요.');
    studentSignupForm.reset();
  } catch (error) {
    alert('회원가입 실패: ' + error.message);
  }
});

// 로그아웃 처리
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    alert('로그아웃 실패: ' + error.message);
  }
});

// 할 일 추가 로직
todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text || !auth.currentUser) return;
  
  try {
    await addDoc(collection(db, 'todos'), {
      text: text,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    todoInput.value = '';
  } catch (error) {
    alert('할 일 추가 실패: ' + error.message);
  }
});

// 할 일 목록 불러오기 (실시간 동기화)
function loadTodos(userId) {
  // 현재 사용자의 할 일만 쿼리
  const q = query(
    collection(db, 'todos'), 
    where('userId', '==', userId)
  );
  
  unsubscribeTodos = onSnapshot(q, (snapshot) => {
    todoList.innerHTML = '';
    
    // JS 배열로 만들어서 최신순 정렬 (Firestore 인덱스 오류 방지)
    const items = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    items.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA; // 내림차순 (최신 항목이 위로)
    });

    // 화면에 렌더링
    items.forEach((data) => {
      const li = document.createElement('li');
      li.className = 'todo-item';
      
      const span = document.createElement('span');
      span.textContent = data.text;
      
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.onclick = () => deleteTodo(data.id);
      
      li.appendChild(span);
      li.appendChild(delBtn);
      todoList.appendChild(li);
    });
  }, (error) => {
    console.error('할 일 목록 불러오기 실패:', error);
  });
}

// 할 일 삭제 로직
async function deleteTodo(docId) {
  try {
    await deleteDoc(doc(db, 'todos', docId));
  } catch (error) {
    alert('삭제 실패: ' + error.message);
  }
}

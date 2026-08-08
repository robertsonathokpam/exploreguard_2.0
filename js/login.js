import { auth, db } from '../firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";//login, logout, signup functions are here

// Render Lucide Icons
lucide.createIcons();

// If already logged in, redirect straight to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'dashboard.html';
});

window.showTab = (tab) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab')[tab === 'login' ? 0 : 1].classList.add('active');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';

  // Hide error messages when switching tabs
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('signup-error').style.display = 'none';
  document.getElementById('signup-success').style.display = 'none';
};

window.loginUser = async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const errText = document.getElementById('login-err-text');

  if (!email || !password) {
    errText.textContent = 'Please fill in all fields.';
    errEl.style.display = 'flex';
    return;
  }

  try {
    errEl.style.display = 'none';
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'dashboard.html';
  } catch (e) {
    errText.textContent = 'Invalid email or password. Please try again.';
    errEl.style.display = 'flex';
  }
};

window.signupUser = async () => {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  const errText = document.getElementById('signup-err-text');
  const sucEl = document.getElementById('signup-success');
  const sucText = document.getElementById('signup-suc-text');

  if (!name || !email || !password) {
    errText.textContent = 'Please fill in all fields.';
    errEl.style.display = 'flex';
    return;
  }

  if (password.length < 6) {
    errText.textContent = 'Password must be at least 6 characters long.';
    errEl.style.display = 'flex';
    return;
  }

  try {
    errEl.style.display = 'none';
    sucEl.style.display = 'none';
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    // Save user profile to Firestore (CREATE operation)
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    });

    sucText.textContent = 'Account created successfully! Redirecting...';
    sucEl.style.display = 'flex';
    setTimeout(() => window.location.href = 'dashboard.html', 1200);
  } catch (e) {
    errText.textContent = e.message.replace('Firebase: ', '');
    errEl.style.display = 'flex';
  }
};

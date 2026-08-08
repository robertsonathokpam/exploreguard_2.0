import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Initialize Lucide Icons
lucide.createIcons();

let currentUser = null;
let selectedType = 'Flight';

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  document.getElementById('date').min = new Date().toISOString().split('T')[0];
});

window.setType = (type, el) => {
  selectedType = type;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
};

// CREATE operation — save new booking to Firestore
window.saveBooking = async () => {
  const from = document.getElementById('from').value.trim();
  const to = document.getElementById('to').value.trim();
  const date = document.getElementById('date').value;
  const passengers = document.getElementById('passengers').value;
  const notes = document.getElementById('notes').value.trim();

  if (!from || !to || !date) { alert('Please fill in From, To, and Date fields.'); return; }

  try {
    await addDoc(collection(db, 'bookings'), {
      userId: currentUser.uid,
      type: selectedType,
      from, to, date, passengers, notes,
      createdAt: new Date().toISOString()
    });
    
    const successEl = document.getElementById('success-msg');
    successEl.style.display = 'flex';
    
    // Clear inputs
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    document.getElementById('date').value = '';
    document.getElementById('notes').value = '';
    
    // Hide success message after 4 seconds
    setTimeout(() => {
      successEl.style.display = 'none';
    }, 4000);
    
  } catch (e) {
    console.error("Error saving booking:", e);
    alert('Booking request failed: ' + e.message);
  }
};

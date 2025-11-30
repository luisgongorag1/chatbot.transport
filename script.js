/* ---------------------------------------------------------
   GOOGLE MAPS + AUTOCOMPLETE
--------------------------------------------------------- */
function initMap() {}

/* ---------------------------------------------------------
   CHATBOT — FINAL VERSION WITH EXTERNAL API CONNECTION
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {

    // ======== API SERVICE (CONNECTION TO YOUR BACKEND ON CONTABO) ========
    // !!!CHANGE THIS URL TO YOUR CONTABO SERVER IP!!!
    const apiService = {
        // Example: 'http://123.45.67.89:3001/api/auth'
        baseUrl: 'http://46.250.243.237:3001',

        async login(email, password) {
            try {
                const response = await fetch(`${this.baseUrl}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Error logging in');
                }
                localStorage.setItem('dhl_token', data.token);
                localStorage.setItem('dhl_user', JSON.stringify(data.user));
                return data.user;
            } catch (error) {
                console.error('Login error:', error);
                throw error;
            }
        },

        async register(name, email, password) {
            try {
                const response = await fetch(`${this.baseUrl}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Error registering');
                }
                return this.login(email, password);
            } catch (error) {
                console.error('Register error:', error);
                throw error;
            }
        },

        logout() {
            localStorage.removeItem('dhl_token');
            localStorage.removeItem('dhl_user');
        },

        isLoggedIn() {
            return localStorage.getItem('dhl_token') !== null;
        },

        getCurrentUser() {
            const userData = localStorage.getItem('dhl_user');
            return userData ? JSON.parse(userData) : null;
        }
    };

    // Update authentication UI
    function updateAuthUI() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        
        if (apiService.isLoggedIn()) {
            const user = apiService.getCurrentUser();
            userName.textContent = user.name;
            loginForm.style.display = 'none';
            signupForm.style.display = 'none';
            userInfo.style.display = 'flex';
        } else {
            loginForm.style.display = 'flex';
            signupForm.style.display = 'none';
            userInfo.style.display = 'none';
        }
    }

    // Authentication Event Listeners
    document.getElementById('login-btn').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) return addMessage("Please fill in all fields.", "bot");
        
        try {
            const user = await apiService.login(email, password);
            updateAuthUI();
            addMessage(`Welcome back, ${user.name}! You have logged in successfully.`);
            start();
        } catch (error) {
            addMessage(`Error: ${error.message}`, "bot");
        }
    });

    document.getElementById('signup-btn').addEventListener('click', async () => {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        if (!name || !email || !password) return addMessage("Please fill in all fields.", "bot");
        
        try {
            const user = await apiService.register(name, email, password);
            updateAuthUI();
            addMessage(`Registration successful! Welcome, ${user.name}.`);
            start();
        } catch (error) {
            addMessage(`Error: ${error.message}`, "bot");
        }
    });

    document.getElementById('signup-toggle-btn').addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'flex';
    });
    
    document.getElementById('login-toggle-btn').addEventListener('click', () => {
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        apiService.logout();
        updateAuthUI();
        location.reload();
    });

    // Initialize authentication UI
    updateAuthUI();
    // ======== END OF AUTHENTICATION SYSTEM ========

    const chatMessages = document.getElementById("chat-messages");
    const userInput = document.getElementById("user-input");
    const sendBtn   = document.getElementById("send-btn");

    const bookingData = {
        collectionAddress: "", collectionDate: "", collectionTime: "",
        palletQuantity: "", chepsQuantity: "", productType: "",
        deliveryAddress: "", deliveryDate: "", deliveryTime: "",
        senderPhoto: ""
    };

    const conversationFlow = [
        { key: "collectionAddress", question: "Please enter the collection address:", type: "address" },
        { key: "collectionDateTime", question: "When would you like to schedule the collection?", type: "datetime" },
        { key: "palletQuantity", question: "How many pallets?", type: "number" },
        { key: "chepsQuantity", question: "How many CHEPS?", type: "number" },
        { key: "productType", question: "What is the product type?", type: "options", options: ["RMP", "Dangerous Goods"] },
        { key: "deliveryAddress", question: "Enter the delivery address:", type: "address" },
        { key: "deliveryDateTime", question: "When would you like to schedule the delivery?", type: "datetime" },
        { key: "senderPhoto", question: "Please upload a sender evidence photo:", type: "photo" }
    ];

    let currentStepIndex = 0;
    let activeElements = {};

    function addMessage(text, sender = "bot") {
        const div = document.createElement("div");
        div.className = `message ${sender}`;
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function generateSecureTrackingNumber() {
        const arr = new Uint8Array(8);
        crypto.getRandomValues(arr);
        return "DHL" + Array.from(arr, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    function formatDate(date) {
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
    }

    function formatTime(date) {
        let h = date.getHours(); const ampm = h >= 12 ? "pm" : "am";
        h = h % 12 || 12;
        const m = date.getMinutes().toString().padStart(2, "0");
        return `${h}:${m} ${ampm}`;
    }

    function getCurrentDateTime() { return new Date().toISOString().slice(0, 16); }
    function disableActiveElements() {
        Object.values(activeElements).flat().forEach(el => { if (el.tagName) el.disabled = true; });
        activeElements = {}; userInput.classList.remove("input-active");
    }

    function updateBookingSummary() {
        document.getElementById("summary-collection-address").textContent = bookingData.collectionAddress || "-";
        document.getElementById("summary-collection-date").textContent = bookingData.collectionDate || "-";
        document.getElementById("summary-collection-time").textContent = bookingData.collectionTime || "-";
        document.getElementById("summary-pallet-quantity").textContent = bookingData.palletQuantity || "-";
        document.getElementById("summary-cheps-quantity").textContent = bookingData.chepsQuantity || "-";
        document.getElementById("summary-product-type").textContent = bookingData.productType || "-";
        document.getElementById("summary-delivery-address").textContent = bookingData.deliveryAddress || "-";
        document.getElementById("summary-delivery-date").textContent = bookingData.deliveryDate || "-";
        document.getElementById("summary-delivery-time").textContent = bookingData.deliveryTime || "-";
        
        const photoElement = document.getElementById("summary-sender-photo");
        if (bookingData.senderPhoto) {
            photoElement.textContent = "";
            const img = document.createElement("img"); img.src = bookingData.senderPhoto;
            img.className = "photo-preview"; img.alt = "Sender Photo";
            photoElement.appendChild(img);
        } else { photoElement.textContent = "-"; }
    }

    function processResponse(key, value) {
        bookingData[key] = value;
        if (key !== "senderPhoto") { addMessage(value, "user"); } else { addMessage("Photo uploaded successfully", "user"); }
        updateBookingSummary(); disableActiveElements(); currentStepIndex++;
        if (currentStepIndex < conversationFlow.length) {
            const next = conversationFlow[currentStepIndex];
            setTimeout(() => { addMessage(next.question); createInputField(next); }, 300);
        } else {
            addMessage("Thank you! Please review the summary and click 'Generate Tracking Number'.");
            document.getElementById("generate-tracking-btn").style.display = "block";
        }
    }

    function createInputField(step) {
        userInput.disabled = true; sendBtn.disabled = true;
        if (step.type === "address") {
            const input = document.createElement("input"); input.className = "autocomplete-box"; input.placeholder = "Start typing address..."; chatMessages.appendChild(input);
            const btn = document.createElement("button"); btn.className = "confirm-address-btn"; btn.textContent = "Confirm Address"; btn.disabled = true; chatMessages.appendChild(btn);
            const autocomplete = new google.maps.places.Autocomplete(input, { fields: ["formatted_address"], componentRestrictions: { country: ["nz"] } });
            autocomplete.addListener("place_changed", () => { const p = autocomplete.getPlace(); if (p?.formatted_address) { input.value = p.formatted_address; btn.disabled = false; } });
            btn.onclick = () => processResponse(step.key, input.value);
            activeElements = { input, btn }; input.focus();
        } else if (step.type === "datetime") {
            const btn = document.createElement("button"); btn.className = "calendar-button"; btn.innerHTML = '<i class="fas fa-calendar-alt"></i> Select Date & Time'; chatMessages.appendChild(btn);
            btn.onclick = () => openDateTimeModal(step.key, btn); activeElements = { btn };
        } else if (step.type === "options") {
            const container = document.createElement("div"); container.className = "options-container";
            step.options.forEach(option => {
                const btn = document.createElement("button"); btn.className = "option-button"; btn.textContent = option;
                btn.onclick = () => { btn.style.backgroundColor = "#27ae60"; processResponse(step.key, option); setTimeout(() => { container.querySelectorAll(".option-button").forEach(b => { b.disabled = true; if (b !== btn) b.style.backgroundColor = "#95a5a6"; }); btn.disabled = true; }, 150); };
                container.appendChild(btn);
            });
            chatMessages.appendChild(container); activeElements = { container };
        } else if (step.type === "photo") {
            const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.style.display = "none";
            const btn = document.createElement("button"); btn.className = "file-button"; btn.innerHTML = '<i class="fas fa-camera"></i> Upload Photo'; btn.onclick = () => input.click();
            input.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => processResponse(step.key, reader.result); reader.readAsDataURL(file); };
            chatMessages.appendChild(btn); chatMessages.appendChild(input); activeElements = { btn, input };
        } else if (step.type === "number") {
            userInput.disabled = false; sendBtn.disabled = false; userInput.value = ""; userInput.focus(); userInput.classList.add("input-active"); activeElements = { userInput, sendBtn };
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function openDateTimeModal(key, btn) {
        const modal = document.getElementById("calendar-modal"); const picker = document.getElementById("datetime-picker"); const confirm = document.getElementById("confirm-datetime");
        picker.value = ""; picker.min = getCurrentDateTime(); modal.style.display = "block";
        confirm.onclick = () => {
            if (!picker.value) return addMessage("❌ Please select a valid date");
            const d = new Date(picker.value); if (d < new Date()) return addMessage("❌ Date must be in the future");
            const fDate = formatDate(d); const fTime = formatTime(d);
            if (key === "collectionDateTime") { bookingData.collectionDate = fDate; bookingData.collectionTime = fTime; } else { bookingData.deliveryDate = fDate; bookingData.deliveryTime = fTime; }
            processResponse(key, `${fDate} at ${fTime}`); modal.style.display = "none"; btn.disabled = true;
        };
        document.querySelector(".close").onclick = () => modal.style.display = "none";
    }

    userInput.addEventListener("keydown", e => { if (e.key !== "Enter" || userInput.disabled) return; const step = conversationFlow[currentStepIndex]; if (step.type === "number") { const v = userInput.value.trim(); if (!/^\d+$/.test(v)) return addMessage("❌ Please enter a valid number"); processResponse(step.key, v); userInput.value = ""; } });
    sendBtn.addEventListener("click", () => { const step = conversationFlow[currentStepIndex]; if (step.type === "number") { const v = userInput.value.trim(); if (!/^\d+$/.test(v)) return addMessage("❌ Please enter a valid number"); processResponse(step.key, v); userInput.value = ""; } });

    document.getElementById("generate-tracking-btn").addEventListener("click", () => {
        const btn = document.getElementById("generate-tracking-btn"); btn.disabled = true;
        const tracking = generateSecureTrackingNumber(); const user = apiService.getCurrentUser();
        document.getElementById("tracking-number-display").textContent = tracking; document.getElementById("tracking-section").style.display = "block";
        addMessage("Booking confirmed!"); addMessage("Your tracking number is: " + tracking); addMessage("Thank you for using the DHL Booking Assistant!");
        
        fetch("https://hook.us2.make.com/j2r2b405xudn12o6o6qnfmii79r1s1hh", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...bookingData, trackingNumber: tracking, timestamp: new Date().toISOString(), user: { name: user.name, email: user.email } })
        }).then(res => { if (res.ok) { addMessage("📡 Booking sent to the system successfully."); } else { addMessage("⚠️ Error sending booking to the system."); } }).catch(() => { addMessage("❌ Network error sending booking."); });

        const restartBtn = document.createElement("button"); restartBtn.className = "interactive-button"; restartBtn.textContent = "Start New Booking"; restartBtn.onclick = () => location.reload();
        chatMessages.appendChild(restartBtn); chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    function start() {
        chatMessages.innerHTML = ''; addMessage("Hello and welcome to the DHL Booking Assistant!");
        setTimeout(() => {
            const btn = document.createElement("button"); btn.className = "interactive-button"; btn.textContent = "Start Booking";
            btn.onclick = () => { btn.remove(); addMessage(conversationFlow[0].question); createInputField(conversationFlow[0]); };
            chatMessages.appendChild(btn);
        }, 400);
    }

    if (apiService.isLoggedIn()) { start(); } else { addMessage("Please log in or sign up to start creating your booking."); }

});

    let drills = [];
    let goals = [];
    let editingId = null;
    let perfChart, pieChart, weeklyChart;
    
    const subjectsList = ["Psych Assessment", "Abnormal Psychology", "Developmental Psychology", "Industrial Psychology"];
    const subjectMap = {
        "Psych Assessment": "PsychAss",
        "Abnormal Psychology": "AbPsych",
        "Developmental Psychology": "DevPsych",
        "Industrial Psychology": "I/O"
    };
    const subjectColors = { 
        "Psych Assessment": "#22c55e", 
        "Abnormal Psychology": "#3b82f6", 
        "Developmental Psychology": "#ef4444", 
        "Industrial Psychology": "#eab308" 
    };

    function getStreakSVG(streak) {
        const max = 5;
        const pct = Math.min(streak, max) / max;
        const bodyStyles = getComputedStyle(document.body);
        const fillColor = bodyStyles.getPropertyValue('--streak-fill') || '#facc15';
        const unfilledColor = bodyStyles.getPropertyValue('--text-muted') || '#94a3b8';

        // SVG with masked Ψ text: a rect fills the text shape proportional to streak
        return `
            <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="vertical-align:middle;">
                <defs>
                    <mask id="psiMask">
                        <rect x="0" y="0" width="44" height="44" fill="black" />
                        <text x="50%" y="62%" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="white">Ψ</text>
                    </mask>
                </defs>
                <!-- base glyph in muted color -->
                <text x="50%" y="62%" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="${unfilledColor.trim()}" style="pointer-events:none;">Ψ</text>
                <!-- filling rectangle masked to the glyph -->
                <rect x="0" y="${44 - Math.round(44 * pct)}" width="44" height="44" fill="${fillColor.trim()}" mask="url(#psiMask)" />
            </svg>
        `;
    }

    function getExamMessage(nick = '') {
        const exams = [new Date('2026-08-19'), new Date('2026-08-20')];
        const today = new Date();

        // find nearest upcoming exam date; if none, fall back to next year's first exam
        let nearest = null;
        let minDays = Infinity;
        for (const d of exams) {
            const days = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
            if (days >= 0 && days < minDays) { minDays = days; nearest = d; }
        }
        if (!nearest) {
            const nextYear = new Date('2027-08-19');
            minDays = Math.ceil((nextYear - today) / (1000 * 60 * 60 * 24));
        }

        const d = minDays;
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];

        const m30 = [
            'You still have plenty of time. Small progress every day matters.',
            'Your future self will thank you for studying today.',
            'Consistency beats cramming. Keep going!',
            'Build the habit now, confidence comes later.'
        ];
        const m15 = [
            '15 days to go — stay focused, you\'re getting closer!',
            'Your hard work is starting to build results.',
            'Keep reviewing. Every session strengthens your memory.',
            'You\'re not behind. Just keep moving forward.'
        ];
        const m7 = [
            '1 week left — trust what you\'ve learned.',
            'Stay calm and review smart.',
            'Focus on understanding, not memorizing everything.',
            'You\'ve prepared for this moment.'
        ];
        const m3 = [
            'Almost there — believe in your preparation.',
            'Review lightly and rest properly.',
            'Confidence grows from effort. You\'ve done the work.',
            'Stay positive, stay steady.'
        ];
        const m1 = [
            'Tomorrow is your time to shine.',
            'Take a deep breath. You are more prepared than you think.',
            'Rest your mind tonight. Confidence matters too.',
            'Trust yourself and do your best.'
        ];
        const m0 = [
            'Today\'s the day — give it your best shot!',
            'Stay calm, read carefully, and trust yourself.',
            'You\'ve prepared for this. Go ace it!',
            'Believe in your progress.'
        ];

        let chosen = '';
        if (d >= 30) chosen = pick(m30);
        else if (d >= 15) chosen = pick(m15);
        else if (d >= 7) chosen = pick(m7);
        else if (d >= 3) chosen = pick(m3);
        else if (d >= 1) chosen = pick(m1);
        else chosen = pick(m0);

        const name = nick && nick.trim() ? nick.trim() : 'Friend';
        const daysText = d === 1 ? '1 day remaining before exam day' : `${d} days remaining before exam day`;
        return `${name}, ${daysText}. ${chosen}`;
    }

    function setMainHeader(nick) {
        document.getElementById('main-header').textContent = getExamMessage(nick);
    }

    function getStorageKey(type) {
        const email = sessionStorage.getItem('rpm_email');
        if (!email) return null;
        const safe = email.replace(/[^a-zA-Z0-9]/g, '_');
        return `rpm_${type}_${safe}`;
    }

    async function loadData() {
        const dKey = getStorageKey('drills');
        const gKey = getStorageKey('goals');
        // If Supabase is initialized, fetch from DB for the signed-in user
        try {
            if (window.supabaseClient && window.supabaseClient.client) {
                const email = sessionStorage.getItem('rpm_email');
                if (email) {
                    const dRes = await window.supabaseClient.fetchDrillsForEmail(email);
                    drills = dRes.data || [];
                    const gRes = await window.supabaseClient.fetchGoalsForEmail(email);
                    goals = gRes.data || [];
                    return;
                }
            }
        } catch (err) {
            console.warn('Supabase load failed, falling back to localStorage', err);
        }

        if (dKey) drills = JSON.parse(localStorage.getItem(dKey)) || [];
        if (gKey) goals = JSON.parse(localStorage.getItem(gKey)) || [];
    }

    async function saveData() {
        const dKey = getStorageKey('drills');
        const gKey = getStorageKey('goals');
        try {
            if (window.supabaseClient && window.supabaseClient.client) {
                // sync arrays to Supabase (requires tables and `id` as upsert key)
                const dRes = await window.supabaseClient.syncDrills(drills.map(d => ({
                    ...d,
                    user_email: sessionStorage.getItem('rpm_email')
                })));

                console.log('DRILL SYNC:', dRes);

                const gRes = await window.supabaseClient.syncGoals(goals.map(g => ({
                    ...g,
                    user_email: sessionStorage.getItem('rpm_email')
                })));

                console.log('GOAL SYNC:', gRes);
                return;
            }
        } catch (err) {
            console.warn('Supabase save failed, falling back to localStorage', err);
        }

        if (dKey) localStorage.setItem(dKey, JSON.stringify(drills));
        if (gKey) localStorage.setItem(gKey, JSON.stringify(goals));
    }

    function switchTab(tab, e) {
        document.querySelectorAll('main, section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`${tab}-section`).classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        // Handle sidebar active state for both click and direct calls
        if (e && e.target) {
            e.target.closest('.nav-btn').classList.add('active');
        } else {
            const btns = document.querySelectorAll('.nav-btn');
            btns.forEach(b => {
                if(b.innerText.toLowerCase().includes(tab)) b.classList.add('active');
            });
        }

        if (tab === 'dashboard') updateDashboard();
        if (tab === 'subjects') updateSubjects();
        if (tab === 'goals') updateGoals();
    }

    function toggleTheme() {
        const body = document.body;
        body.classList.toggle('light-theme');
        const isLight = body.classList.contains('light-theme');
        document.querySelector('#themeBtn i').className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('rpm_theme', isLight ? 'light' : 'dark');
        renderCharts(); // Re-render to adapt chart colors if needed
    }

    function logout() {
        sessionStorage.clear();
        location.reload();
    }

    function addNote(text = null, checked = false) {
        const input = document.getElementById('noteInput');
        const val = text || input.value.trim();
        if (!val) return;
        const container = document.getElementById('notes-container');
        const div = document.createElement('div');
        div.style = "display:flex; align-items:center; justify-content:space-between; background:var(--input-bg); padding:10px 15px; border-radius:12px;";
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <input type="checkbox" class="note-cb" value="${val}" ${checked ? 'checked' : ''} style="width:18px; height:18px;">
                <span style="font-size:0.85rem;">${val}</span>
            </div>
            <button onclick="this.parentElement.remove()" style="color:var(--fail-color); background:none; border:none; cursor:pointer; font-size:1.2rem;">&times;</button>
        `;
        container.appendChild(div);
        if (!text) input.value = '';
    }

    document.getElementById('drillForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const correct = parseInt(document.getElementById('correctAnswers').value);
        const total = parseInt(document.getElementById('totalItems').value);
        const rate = Math.round((correct / total) * 100);
        const notes = Array.from(document.querySelectorAll('.note-cb:checked')).map(c => c.value).join(', ');
        const date = document.getElementById('drillDate').value;
        const subject = document.getElementById('drillSubject').value;
        const title = document.getElementById('drillTitle').value;
        const link = document.getElementById('answerLink').value;

        // Confirmation dialog
        const confirmMsg = `Please confirm your record:\n\nDate: ${date}\nSubject: ${subject}\nTitle: ${title}\nTotal Items: ${total}\nYour Score: ${correct}\nRate: ${rate}%\n\nIs this correct?`;
        if (!confirm(confirmMsg)) return;

        const entry = {
            id: editingId || Date.now().toString(),
            date, subject, title,
            total, correct, rate, notes,
            link,
            result: rate >= 75 ? 'PASS' : 'FAIL'
        };

        if (editingId) drills = drills.map(d => d.id === editingId ? entry : d);
        else drills.push(entry);

        saveData();
        resetForm();
        updateDashboard();
    });

    function resetForm() {
        editingId = null;
        document.getElementById('drillForm').reset();
        document.getElementById('notes-container').innerHTML = '';
        document.getElementById('submitBtn').textContent = 'Save Record';
        document.getElementById('formTitle').textContent = 'Log New Drill';
        document.getElementById('cancelBtn').classList.add('hidden');
    }

    function deleteDrill(id) {
        if (confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
            drills = drills.filter(d => d.id !== id);
            saveData();
            updateDashboard();
        }
    }

    function editDrill(id) {
        const d = drills.find(x => x.id === id);
        if (!d) return;
        editingId = id;
        document.getElementById('drillDate').value = d.date;
        document.getElementById('drillSubject').value = d.subject;
        document.getElementById('drillTitle').value = d.title;
        document.getElementById('totalItems').value = d.total;
        document.getElementById('correctAnswers').value = d.correct;
        document.getElementById('answerLink').value = d.link;
        document.getElementById('notes-container').innerHTML = '';
        if (d.notes) d.notes.split(', ').forEach(n => addNote(n, false));
        
        document.getElementById('submitBtn').textContent = 'Update Record';
        document.getElementById('formTitle').textContent = 'Editing Record';
        document.getElementById('cancelBtn').classList.remove('hidden');
        document.getElementById('drills-section').scrollIntoView();
    }

    function updateDashboard() {
        const total = drills.length;
        const avg = total > 0 ? Math.round(drills.reduce((s, d) => s + d.rate, 0) / total) : 0;
        
        // Calculate achieved goals
        let achievedCount = 0;
        goals.forEach(g => {
            const relevant = drills.filter(d => 
                d.subject === g.subject && 
                new Date(d.date) >= new Date(g.start) && 
                new Date(d.date) <= new Date(g.end)
            );
            const tScore = relevant.reduce((s, d) => s + d.correct, 0);
            const tItems = relevant.reduce((s, d) => s + d.total, 0);
            const curAvg = tItems > 0 ? Math.round((tScore / tItems) * 100) : 0;
            if (curAvg >= g.target) achievedCount++;
        });

        // Botanical Streak Logic
        let streak = 0;
        const sorted = [...drills].sort((a, b) => new Date(b.date) - new Date(a.date));
        for (let d of sorted) {
            if (d.result === 'PASS') streak++;
            else break;
        }
        // Render streak as a psychology Ψ glyph progressively filled

        document.getElementById('stat-total-drills').textContent = total;
        document.getElementById('stat-avg-score').textContent = `${avg}%`;
        document.getElementById('stat-goals-done').textContent = achievedCount;
        document.getElementById('stat-streak').innerHTML = `${streak} ` + getStreakSVG(streak);

        renderCharts();
        renderTable();
    }

    let tableShowAll = false;

    function renderTable(data = null) {
        const display = data || drills;
        const reversed = display.slice().reverse();
        const toDisplay = tableShowAll ? reversed : reversed.slice(0, 3);
        const tbody = document.getElementById('drillsTableBody');
        tbody.innerHTML = toDisplay.map(d => `
            <tr>
                <td>${d.date}</td><td>${d.subject}</td><td>${d.total}</td><td>${d.correct}</td><td>${d.rate}%</td>
                <td><span class="badge ${d.result === 'PASS' ? 'badge-pass' : 'badge-fail'}">${d.result}</span></td>
                <td>${d.title}</td><td>${d.link ? `<a href="${d.link}" target="_blank" style="color:var(--primary); text-decoration:none;">🔗 View</a>` : '-'}</td>
                <td>
                    <button onclick="editDrill('${d.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; margin-right:12px; font-size:1.1rem;"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteDrill('${d.id}')" style="background:none; border:none; color:var(--fail-color); cursor:pointer; font-size:1.1rem;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        
        // Show "See All" button if there are more than 3 records and not currently showing all
        const seeAllBtn = document.getElementById('seeAllBtn');
        if (reversed.length > 3) {
            seeAllBtn.style.display = 'block';
            seeAllBtn.textContent = tableShowAll ? 'Show Less' : 'See All Records';
        } else {
            seeAllBtn.style.display = 'none';
        }
    }

    function toggleSeeAll() {
        tableShowAll = !tableShowAll;
        renderTable();
    }

    function filterRecords() {
        const query = document.getElementById('tableSearch').value.toLowerCase();
        const filtered = drills.filter(d => d.subject.toLowerCase().includes(query) || d.title.toLowerCase().includes(query));
        tableShowAll = false;  // Reset to show only 3 when filtering
        renderTable(filtered);
    }

    async function downloadPDF() {
        // Reload data from Supabase to ensure we have the latest records
        await loadData();
        
        if (drills.length === 0) {
            alert('No drill records found. Please log your drills first before downloading.');
            return;
        }
        
        const userName = sessionStorage.getItem('rpm_user') || 'User';
        const timestamp = new Date().toLocaleDateString();
        const time = new Date().toLocaleTimeString();
        
        // Create a container for PDF content
        const container = document.createElement('div');
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.padding = '20px';
        container.style.backgroundColor = '#fff';
        
        // Add header
        const header = document.createElement('div');
        header.innerHTML = `
            <h1 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">PsyTrack - Drill Records</h1>
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;"><strong>User:</strong> ${userName}</p>
            <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;"><strong>Generated:</strong> ${timestamp} at ${time}</p>
            <hr style="margin: 20px 0; border: none; border-top: 2px solid #ddd;">
        `;
        container.appendChild(header);
        
        // Create table with drill data
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '20px';
        
        // Table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#f0f0f0';
        const headers = ['Date', 'Subject', 'Items', 'Score', 'Rate %', 'Result', 'Title', 'Link'];
        headers.forEach(h => {
            const th = document.createElement('th');
            th.style.border = '1px solid #ddd';
            th.style.padding = '10px';
            th.style.textAlign = 'left';
            th.style.fontWeight = 'bold';
            th.style.fontSize = '12px';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Table body with drill data
        const tbody = document.createElement('tbody');
        drills.slice().reverse().forEach((d, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
            
            const cells = [
                d.date,
                d.subject,
                d.total,
                d.correct,
                `${d.rate}%`,
                d.result,
                d.title,
                d.link ? 'Yes' : 'No'
            ];
            
            cells.forEach(cell => {
                const td = document.createElement('td');
                td.style.border = '1px solid #ddd';
                td.style.padding = '10px';
                td.style.fontSize = '11px';
                td.textContent = cell;
                row.appendChild(td);
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
        
        // Add summary at the bottom
        const summary = document.createElement('div');
        summary.style.marginTop = '30px';
        summary.style.paddingTop = '20px';
        summary.style.borderTop = '2px solid #ddd';
        summary.innerHTML = `
            <p style="margin: 5px 0; color: #666; font-size: 12px;"><strong>Total Drills:</strong> ${drills.length}</p>
            <p style="margin: 5px 0; color: #666; font-size: 12px;"><strong>Passes:</strong> ${drills.filter(d => d.result === 'PASS').length}</p>
            <p style="margin: 5px 0; color: #666; font-size: 12px;"><strong>Fails:</strong> ${drills.filter(d => d.result === 'FAIL').length}</p>
            <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">Generated automatically by PsyTrack</p>
        `;
        container.appendChild(summary);
        
        // PDF options
        const opt = {
            margin: 10,
            filename: `PsyTrack_Records_${timestamp.replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
        };
        
        // Generate PDF
        html2pdf().set(opt).from(container).save();
    }

    function updateSubjects() {
        const grid = document.getElementById('subjects-grid');
        const header = document.getElementById('subjects-summary-header');
        grid.innerHTML = '';
        
        let stats = subjectsList.map(s => {
            const relevant = drills.filter(d => d.subject === s);
            const totalItems = relevant.reduce((sum, d) => sum + d.total, 0);
            const totalScore = relevant.reduce((sum, d) => sum + d.correct, 0);
            const avg = totalItems > 0 ? Math.round((totalScore / totalItems) * 100) : 0;
            return { s, totalItems, totalScore, avg };
        });

        const sortedStats = [...stats].filter(st => st.totalItems > 0).sort((a, b) => b.avg - a.avg);
        const strongest = sortedStats[0] || { s: '-', avg: 0 };
        const weakest = sortedStats[sortedStats.length - 1] || { s: '-', avg: 0 };

        header.innerHTML = `
            <div class="glass-card stat-card" style="border-left: 6px solid var(--pass-color);">
                <span class="stat-label">Strongest Subject</span>
                <span class="stat-value" style="font-size:1.2rem; color:var(--pass-color);">${strongest.s}</span>
                <span style="font-size:0.8rem;">Average: ${strongest.avg}%</span>
            </div>
            <div class="glass-card stat-card" style="border-left: 6px solid var(--fail-color);">
                <span class="stat-label">Weakest Subject</span>
                <span class="stat-value" style="font-size:1.2rem; color:var(--fail-color);">${weakest.s}</span>
                <span style="font-size:0.8rem;">Average: ${weakest.avg}%</span>
            </div>
        `;

        stats.forEach(st => {
            const div = document.createElement('div');
            div.className = "glass-card";
            div.innerHTML = `
                <h3 style="color: ${subjectColors[st.s]}; margin-bottom:15px; font-size:1.1rem;">${st.s}</h3>
                <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between;"><span>Total Questions:</span><b>${st.totalItems}</b></div>
                    <div style="display:flex; justify-content:space-between;"><span>Total Correct:</span><b>${st.totalScore}</b></div>
                    <div style="display:flex; justify-content:space-between;"><span>Average Score:</span><b>${st.avg}%</b></div>
                </div>
                <div style="width:100%; height:8px; background:var(--input-bg); border-radius:4px; margin-top:15px; overflow:hidden;">
                    <div style="height:100%; width:${st.avg}%; background:${subjectColors[st.s]};"></div>
                </div>
            `;
            grid.appendChild(div);
        });
    }

    function updateGoals() {
        const container = document.getElementById('goals-list');
        container.innerHTML = '';
        goals.forEach(g => {
            const relevant = drills.filter(d => 
                d.subject === g.subject && 
                new Date(d.date) >= new Date(g.start) && 
                new Date(d.date) <= new Date(g.end)
            );
            const totalScore = relevant.reduce((s, d) => s + d.correct, 0);
            const totalItems = relevant.reduce((s, d) => s + d.total, 0);
            const currentAvg = totalItems > 0 ? Math.round((totalScore / totalItems) * 100) : 0;
            const isDone = currentAvg >= g.target;
            const progress = Math.min(Math.round((currentAvg / g.target) * 100), 100);

            const div = document.createElement('div');
            div.className = "glass-card";
            div.style = "margin-bottom:0;";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:12px;">
                    <span style="font-size:0.9rem;">${g.title}</span>
                    <span style="font-size:0.9rem;">${currentAvg}% / ${g.target}%</span>
                </div>
                <div style="width:100%; height:12px; background:var(--input-bg); border-radius:6px; overflow:hidden; margin-bottom:12px;">
                    <div style="height:100%; width:${progress}%; background:var(--primary); transition:0.5s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
                    <span style="font-weight:700; color:${isDone ? 'var(--pass-color)' : 'var(--text-muted)'}">${isDone ? 'STATUS: ACHIEVED ✅' : 'STATUS: IN PROGRESS'}</span>
                    <button onclick="deleteGoal('${g.id}')" style="background:none; border:none; color:var(--fail-color); cursor:pointer;">Delete</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    document.getElementById('goalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        goals.push({
            id: Date.now().toString(),
            title: document.getElementById('goalTitle').value,
            subject: document.getElementById('goalSubject').value,
            target: parseInt(document.getElementById('goalTarget').value),
            duration: document.getElementById('goalDuration').value,
            start: document.getElementById('goalStart').value,
            end: document.getElementById('goalEnd').value
        });
        saveData();
        document.getElementById('goalForm').reset();
        updateGoals();
    });

    function deleteGoal(id) { goals = goals.filter(g => g.id !== id); saveData(); updateGoals(); }

    function renderCharts() {
        const ctxPerf = document.getElementById('performanceChart').getContext('2d');
        const ctxPie = document.getElementById('passFailChart').getContext('2d');
        const ctxWeek = document.getElementById('weeklyChart').getContext('2d');

        if (perfChart) perfChart.destroy();
        if (pieChart) pieChart.destroy();
        if (weeklyChart) weeklyChart.destroy();

        const themeColor = document.body.classList.contains('light-theme') ? '#475569' : '#94a3b8';
        const gridColor = document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

        const filter = document.getElementById('trendFilter').value;
        const subToChart = filter === 'All' ? subjectsList : [filter];

        // Integer-only scale config
        const scaleConfig = {
            ticks: { color: themeColor, stepSize: 10, callback: (v) => v % 1 === 0 ? v : null },
            grid: { color: gridColor }
        };

        perfChart = new Chart(ctxPerf, {
            type: 'line',
            data: {
                labels: Array.from({length: 10}, (_, i) => `S${i+1}`),
                datasets: subToChart.map(s => ({
                    label: subjectMap[s], // Abbreviated
                    data: drills.filter(d => d.subject === s).slice(-10).map(d => d.rate),
                    borderColor: subjectColors[s],
                    backgroundColor: subjectColors[s],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                }))
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { labels: { color: themeColor, font: { size: 10 } } } },
                scales: { x: { ticks: { color: themeColor }, grid: { display: false } }, y: scaleConfig }
            }
        });

        const p = drills.filter(d => d.result === 'PASS').length;
        pieChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: { 
                labels: ['Pass', 'Fail'], 
                datasets: [{ data: [p, drills.length - p], backgroundColor: ['#22c55e', '#ef4444'], borderDash: [5,5], borderWidth: 0 }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: themeColor } } }
            }
        });

        const weeks = {};
        drills.forEach(d => {
            const dt = new Date(d.date);
            const start = new Date(dt.setDate(dt.getDate() - dt.getDay())).toISOString().split('T')[0];
            if (!weeks[start]) weeks[start] = { sum: 0, count: 0 };
            weeks[start].sum += d.rate;
            weeks[start].count++;
        });
        const wLabels = Object.keys(weeks).sort();
        const wData = wLabels.map(w => Math.round(weeks[w].sum / weeks[w].count));

        weeklyChart = new Chart(ctxWeek, {
            type: 'line',
            data: { 
                labels: wLabels, 
                datasets: [{ 
                    label: 'Avg %', 
                    data: wData, 
                    borderColor: '#6366f1', 
                    backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                    fill: true, 
                    tension: 0.4 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: themeColor }, grid: { display: false } }, y: scaleConfig }
            }
        });
    }

    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const nick = document.getElementById('authNickname').value;
        const password = document.getElementById('authPassword').value;
        if (!email.includes('@gmail.com')) return alert('Please use a Gmail address.');

        // If Supabase is available, try to sign in; if user doesn't exist, sign up.
        if (window.supabaseClient && window.supabaseClient.client) {
            try {
                await window.supabaseClient.signIn(email, password);
            } catch (err) {
                // try sign up flow
                try {
                    await window.supabaseClient.signUp(email, password, { nickname: nick });
                    // After signUp, attempt signIn again (may require email confirmation depending on project settings)
                    await window.supabaseClient.signIn(email, password);
                } catch (err2) {
                    console.warn('Supabase auth failed, falling back to local session:', err2);
                    sessionStorage.setItem('rpm_email', email);
                    sessionStorage.setItem('rpm_user', nick);
                    document.getElementById('auth-overlay').classList.add('hidden');
                    setMainHeader(nick);
                    await loadData();
                    updateDashboard();
                    return;
                }
            }

            // On successful auth, store email/nick locally and load data from Supabase
            sessionStorage.setItem('rpm_email', email);
            sessionStorage.setItem('rpm_user', nick);
            document.getElementById('auth-overlay').classList.add('hidden');
            setMainHeader(nick);
            await loadData();
            updateDashboard();
            return;
        }

        // Fallback: local session
        sessionStorage.setItem('rpm_email', email);
        sessionStorage.setItem('rpm_user', nick);
        document.getElementById('auth-overlay').classList.add('hidden');
        setMainHeader(nick);
        await loadData();
        updateDashboard();
    });

    const passwordToggle = document.getElementById('togglePassword');
    if (passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const passwordInput = document.getElementById('authPassword');
            const isPasswordVisible = passwordInput.type === 'text';
            passwordInput.type = isPasswordVisible ? 'password' : 'text';
            passwordToggle.classList.toggle('fa-eye', isPasswordVisible);
            passwordToggle.classList.toggle('fa-eye-slash', !isPasswordVisible);
            passwordToggle.title = isPasswordVisible ? 'Show password' : 'Hide password';
        });
    }

   window.onload = async () => {
    if (localStorage.getItem('rpm_theme') === 'light') toggleTheme();

    const savedEmail = sessionStorage.getItem('rpm_email');

    if (savedEmail) {
        document.getElementById('auth-overlay').classList.add('hidden');
        setMainHeader(sessionStorage.getItem('rpm_user'));
        await loadData();
        updateDashboard();
    }
};
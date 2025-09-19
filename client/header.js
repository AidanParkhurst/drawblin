// Header / prompt / scoreboard utilities
// Provides: drawColoredPrompt(prompt, seconds, uiColorOverride?) and drawScoreboard(results, goblins, ui_color)
// Also: drawHeader(text, ui_color) for generic headers and drawWaitingWithScoreboard
import { spawnBurst } from './burst.js';

// Track which revealed tokens we've already celebrated to avoid duplicate bursts
// Key format: `${text}|${occurrenceIndex}` (occurrence is Nth time this text appears)
const revealedSeen = new Set();

export function drawHeader(maskedPrompt, seconds, uiColor, options = {}) {
    const revealBursts = Boolean(options.revealBursts);
    if (!uiColor) uiColor = [0,0,0];
    // Tokenize bracketed reveals: [word]
    const raw = maskedPrompt.split(/(\[[^\]]+\])/).filter(s=> s.length);
    const tokens = raw.map(seg => {
        if (seg.startsWith('[') && seg.endsWith(']')) return { text: seg.slice(1,-1), revealed: true };
        return { text: seg, revealed: false };
    });
    // Collapse adjacent plain tokens
    const compact = [];
    for (const t of tokens) {
        if (!t.revealed && compact.length && !compact[compact.length-1].revealed) {
            compact[compact.length-1].text += t.text;
        } else compact.push({...t});
    }
    // Inject space before revealed if needed
    for (let i=1;i<compact.length;i++) {
        if (compact[i].revealed) {
            const prev = compact[i-1];
            if (prev.text && !prev.text.endsWith(' ') && !compact[i].text.startsWith(' ')) {
                compact.splice(i,0,{text:' ', revealed:false});
                i++;
            }
        }
    }
    const showTimer = seconds > 0;
    const timerStr = showTimer ? ` (${seconds}s)` : '';
    push();
    textSize(24); textAlign(LEFT, CENTER);
    const y = 50;
    const spaceW = Math.max(textWidth(' '), textWidth('_'));
    function measure(str){
        let w=0, run='';
        for (const c of str){
            if (c===' '){ if(run){ w+=textWidth(run); run=''; } w+=spaceW; } else run+=c;
        }
        if (run) w+=textWidth(run); return w;
    }
    const phraseWidth = compact.reduce((w,t)=> w+measure(t.text),0);
    const timerWidth = showTimer ? textWidth(timerStr) : 0;
    let x = width/2 - (phraseWidth + timerWidth)/2;
    // Track per-render occurrence count for revealed texts to build stable keys
    const perRenderCounts = new Map();
    let anyReveals = false;
    for (const t of compact){
        const colored = t.revealed;
        fill(colored?uiColor[0]:30, colored?uiColor[1]:30, colored?uiColor[2]:30, colored?255:204);
        const tokenStartX = x;
        const tokenWidth = measure(t.text);

        // Draw the token char-by-char to keep spacing consistent with measure()
        let run='';
        for (const c of t.text){
            if (c===' '){ if(run){ text(run,x,y); x+=textWidth(run); run=''; } x+=spaceW; }
            else run+=c;
        }
        if (run){ text(run,x,y); x+=textWidth(run); }

        // Trigger burst the first time a revealed token appears (guessing game)
        if (revealBursts && t.revealed && tokenWidth > 0){
            anyReveals = true;
            const prev = perRenderCounts.get(t.text) || 0;
            const occ = prev; // zero-based occurrence index for this text in this render
            perRenderCounts.set(t.text, prev + 1);
            const key = `${t.text}|${occ}`;
            if (!revealedSeen.has(key)){
                const cx = tokenStartX + tokenWidth/2;
                const cy = y; // baseline; visually centered enough for a small pop
                spawnBurst(cx, cy, uiColor, { count: 7 });
                revealedSeen.add(key);
            }
        }
    }
    if (showTimer){ fill(uiColor[0],uiColor[1],uiColor[2],200); text(timerStr,x,y); }
    pop();

    // If there are no revealed segments in this prompt, reset the seen cache so the next round can pop again
    if (revealBursts && !anyReveals) {
        revealedSeen.clear();
    }
}

export function drawScoreboard(results, goblins, ui_color){
    const sorted = [...results].sort((a,b)=> b.score - a.score);
    push();
    textAlign(CENTER, TOP);
    textSize(40); textStyle(BOLD);
    fill(ui_color[0], ui_color[1], ui_color[2]);
    textStyle(NORMAL);
    let yStart = 70, lineH = 44, rank=1;
    for (const r of sorted){
        const artist = goblins.find(g=> g.id === r.userId);
        if (!artist) continue;
        fill(artist.ui_color[0], artist.ui_color[1], artist.ui_color[2]);
        textSize(32);
        text(`${rank}. ${artist.name}  -  ${r.score}`, windowWidth/2, yStart + (rank-1)*lineH);
        rank++;
    }
    pop();
}

export function drawWaitingWithScoreboard(timer, results, goblins, ui_color) {
    const sorted = [...results].sort((a,b)=> b.score - a.score);
    const lineH = 44;
    const titleSize = 48;
    const entrySize = 34;
    const gapBelowTitle = 24;
    const num = sorted.length;
    const totalHeight = titleSize + gapBelowTitle + (num * lineH);
    const topY = Math.max(120, (height - totalHeight)/2); // Keep away from very top where timer goes

    // Draw timer up near header line (similar to drawHeader y=50)
    push();
    textAlign(CENTER, CENTER);
    textSize(24);
    fill(ui_color[0], ui_color[1], ui_color[2]);
    text(`Starting in ${int(timer)}s`, width/2, 50);
    pop();

    // Draw centered scoreboard
    push();
    textAlign(CENTER, TOP);
    textSize(titleSize); textStyle(BOLD);
    fill(ui_color[0], ui_color[1], ui_color[2]);
    text('Scoreboard', width/2, topY);
    textStyle(NORMAL);
    let yStart = topY + titleSize + gapBelowTitle;
    let rank=1;
    for (const r of sorted){
        const artist = goblins.find(g=> g.id === r.userId);
        if (!artist) continue;
        fill(artist.color[0], artist.color[1], artist.color[2]);
        textSize(entrySize);
        text(`${rank}. ${artist.name}  -  ${r.score}`, width/2, yStart + (rank-1)*lineH);
        rank++;
    }
    pop();
}

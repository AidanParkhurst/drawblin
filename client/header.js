// Header / prompt / scoreboard utilities
// Provides: drawColoredPrompt(prompt, seconds, uiColorOverride?) and drawScoreboard(results, goblins, ui_color)
// Also: drawHeader(text, ui_color) for generic headers and drawWaitingWithScoreboard
import { spawnBurst } from './burst.js';
import { playPop } from './audio.js';

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
    // Nudge header slightly lower on touch devices to avoid overlapping top UI
    const isMobileLike = (typeof navigator !== 'undefined' && (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i).test(navigator.userAgent)) || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    const y = isMobileLike ? 70 : 50;
    const spaceW = Math.max(textWidth(' '), textWidth('_'));
    // Add a small gap after each underscore so underscores don't visually merge
    const underscoreW = textWidth('_');
    const underscoreGap = Math.max(1, Math.min(6, Math.round(spaceW * 0.25)));
    function measure(str){
        let w=0, run='';
        for (const c of str){
            if (c===' '){ if(run){ w+=textWidth(run); run=''; } w+=spaceW; }
            else if (c==='_' ){ if(run){ w+=textWidth(run); run=''; } w+=underscoreW + underscoreGap; }
            else run+=c;
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
            else if (c==='_' ){ if(run){ text(run,x,y); x+=textWidth(run); run=''; } text('_', x, y); x += underscoreW + underscoreGap; }
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
                try { playPop(); } catch {}
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
    const lineH = 40;
    const titleSize = 22;
    const entrySize = 30;
    const gapBelowTitle = 14;
    const num = sorted.length;

    // Build line strings for measurement
    const titleText = 'Scoreboard:';
    // Measure widths: need to set textSize prior to each measurement
    push();
    textSize(titleSize);
    let maxWidth = textWidth(titleText);
    for (let i=0;i<sorted.length;i++) {
        const r = sorted[i];
        const artist = goblins.find(g=> g.id === r.userId);
        const line = `${i+1}. ${artist ? artist.name : '???'}  -  ${r.score}`;
        textSize(entrySize);
        const w = textWidth(line);
        if (w > maxWidth) maxWidth = w;
    }
    pop();

    const totalHeight = titleSize + gapBelowTitle + (num * lineH);
    const topPadding = 120;
    const topY = Math.max(topPadding, (height - totalHeight)/2);
    const blockX = width/2 - maxWidth/2; // centered block, left-aligned text

    // Timer centered
    push();
    textAlign(CENTER, CENTER);
    textSize(22);
    fill(ui_color[0], ui_color[1], ui_color[2]);
    text(`Starting in ${int(timer)}s`, width/2, 50);
    pop();

    // Draw scoreboard block
    push();
    textAlign(LEFT, TOP);
    fill(ui_color[0], ui_color[1], ui_color[2]);
    textSize(titleSize); textStyle(BOLD);
    text(titleText, blockX, topY);
    textStyle(NORMAL);
    let yStart = topY + titleSize + gapBelowTitle;
    let rank = 1;
    for (const r of sorted) {
        const artist = goblins.find(g=> g.id === r.userId);
        if (!artist) continue;
        textSize(entrySize);
        fill(artist.ui_color?.[0] ?? artist.color[0], artist.ui_color?.[1] ?? artist.color[1], artist.ui_color?.[2] ?? artist.color[2]);
        text(`${rank}. ${artist.name}  -  ${r.score}`, blockX, yStart + (rank-1)*lineH);
        rank++;
    }
    pop();
}

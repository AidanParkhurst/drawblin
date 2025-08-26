// Header / prompt / scoreboard utilities
// Provides: drawColoredPrompt(prompt, seconds, uiColorOverride?) and drawScoreboard(results, goblins, ui_color)
// Also: drawHeader(text, ui_color) for generic headers and drawWaitingWithScoreboard

export function drawHeader(maskedPrompt, seconds, uiColor) {
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
    for (const t of compact){
        const colored = t.revealed;
        fill(colored?uiColor[0]:30, colored?uiColor[1]:30, colored?uiColor[2]:30, colored?255:204);
        let run='';
        for (const c of t.text){
            if (c===' '){ if(run){ text(run,x,y); x+=textWidth(run); run=''; } x+=spaceW; }
            else run+=c;
        }
        if (run){ text(run,x,y); x+=textWidth(run); }
    }
    if (showTimer){ fill(uiColor[0],uiColor[1],uiColor[2],200); text(timerStr,x,y); }
    pop();
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

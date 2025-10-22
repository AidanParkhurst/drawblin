// Snapshot of original profile display (basic) prior to pet/bling picker enhancements.
// This can be used later for users without entitlements.
import { you, goblins } from './index.js';
import { assets } from './assets.js';
import { sendMessage } from './network.js';
import { calculateUIColor, palette } from './colors.js'; 

class BasicProfileDisplay {
  constructor(width = 420, height = 220) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.visible = false;
    this.targetGoblin = null;
    this.playerX = 0;
    this.playerY = 0;
    this.colorPalette = palette;
    this.colorSize = 20;
    this.colorSpacing = 5;
    this.colorsPerRow = 4;
    this.colorStartX = this.width * 0.58;
    this.colorStartY = 50;
    this.hoveredColor = -1;
    this.shapes = ['manny','stanley','ricky','blimp','hippo','grubby'];
    this.leftArrowHover = false;
    this.rightArrowHover = false;
    this.prevMousePressed = false;
    this.arrowOffset = 80;
    this.arrowSize = 15;
  }
  show(goblinId, playerX, playerY) {
    this.targetGoblin = goblins.find(g => g.id === goblinId) || you;
    this.playerX = playerX;
    this.playerY = playerY;
    this.visible = true;
    this.updatePosition();
  }
  hide() { this.visible = false; this.targetGoblin = null; }
  updatePosition() {
    this.x = this.playerX - this.width / 2;
    this.y = this.playerY - this.height - 40;
    if (this.x < 10) this.x = 10;
    if (this.x + this.width > windowWidth - 10) this.x = windowWidth - this.width - 10;
    if (this.y < 10) this.y = this.playerY + 60;
  }
  update() {
    if (!this.visible || !this.targetGoblin) return;
    this.updatePosition();
    this.hoveredColor = -1; this.leftArrowHover = false; this.rightArrowHover = false;
    const spriteX = this.x + 100; const spriteY = this.y + this.height / 2; const arrowSize = this.arrowSize; const arrowOffset = this.arrowOffset; const justPressed = mouseIsPressed && !this.prevMousePressed;
    const leftTipX = spriteX - arrowOffset; const leftBox = { x: leftTipX, y: spriteY - arrowSize/2, w: arrowSize, h: arrowSize };
    const rightTipX = spriteX + arrowOffset; const rightBox = { x: rightTipX - arrowSize, y: spriteY - arrowSize/2, w: arrowSize, h: arrowSize };
    if (mouseX >= leftBox.x && mouseX <= leftBox.x + leftBox.w && mouseY >= leftBox.y && mouseY <= leftBox.y + leftBox.h) { this.leftArrowHover = true; cursor('pointer'); if (justPressed) this.cycleShape(-1); }
    else if (mouseX >= rightBox.x && mouseX <= rightBox.x + rightBox.w && mouseY >= rightBox.y && mouseY <= rightBox.y + rightBox.h) { this.rightArrowHover = true; cursor('pointer'); if (justPressed) this.cycleShape(1); }
    for (let i = 0; i < this.colorPalette.length; i++) { const col = i % this.colorsPerRow; const row = Math.floor(i / this.colorsPerRow); const colorX = this.x + this.colorStartX + col * (this.colorSize + this.colorSpacing); const colorY = this.y + this.colorStartY + row * (this.colorSize + this.colorSpacing); if (mouseX >= colorX && mouseX <= colorX + this.colorSize && mouseY >= colorY && mouseY <= colorY + this.colorSize) { this.hoveredColor = i; cursor('pointer'); if (mouseIsPressed) this.selectColor(i); break; } }
    if (mouseIsPressed && !this.isMouseInside()) this.hide();
    if (keyIsPressed && key === 'Escape') this.hide();
    this.display(); this.prevMousePressed = mouseIsPressed;
  }
  isMouseInside() { return mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height; }
  isMouseInteracting() { return this.visible && this.isMouseInside(); }
  selectColor(i){ if (i<0||i>=this.colorPalette.length) return; const newColor=[...this.colorPalette[i]]; this.targetGoblin.color=newColor; if (this.targetGoblin===you){ you.ui_color = calculateUIColor(newColor, [240,240,240]); try{ window.dispatchEvent(new CustomEvent('ui:color-changed',{detail:{color:you.ui_color}})); }catch(_){} } const g={ i:this.targetGoblin.id, co:[newColor[0]|0,newColor[1]|0,newColor[2]|0] }; if(this.targetGoblin===you && Array.isArray(you.ui_color)) g.ui=[you.ui_color[0]|0,you.ui_color[1]|0,you.ui_color[2]|0]; sendMessage({type:'update', g}); }
   display(){ if(!this.visible||!this.targetGoblin||you!==this.targetGoblin) return; push(); fill(240); // Even shorter dashes and larger gaps for a lighter appearance
 drawingContext.setLineDash([6,12]); stroke(you.ui_color[0],you.ui_color[1],you.ui_color[2],100); strokeWeight(2); rect(this.x,this.y,this.width,this.height,10); drawingContext.setLineDash([]); noStroke(); const spriteX=this.x+100; const spriteY=this.y+this.height/2; const spriteSize=70; const arrowSize=this.arrowSize; const arrowOffset=this.arrowOffset; if(assets.sprites && assets.sprites[this.targetGoblin.shape]){ const sprite=assets.sprites[this.targetGoblin.shape]; push(); tint(this.targetGoblin.color[0],this.targetGoblin.color[1],this.targetGoblin.color[2]); imageMode(CENTER); image(sprite,spriteX,spriteY,spriteSize,spriteSize * sprite.height / sprite.width); const scaleFactor=spriteSize/45; const handSize=7*scaleFactor; const brushWidth=18*scaleFactor; const brushHeight=11*scaleFactor; let empty_hand_x=spriteX-(30*scaleFactor); image(assets.sprites['empty_hand'],empty_hand_x,spriteY+(10*scaleFactor),handSize,handSize); let brush_hand_x=spriteX+(25*scaleFactor); let brush_hand_y=spriteY; image(assets.sprites['brush_hand'],brush_hand_x,brush_hand_y,handSize,handSize); if(this.targetGoblin.tool==='brush'){ image(assets.sprites['brush'],brush_hand_x+(15*scaleFactor),brush_hand_y-(8*scaleFactor),brushWidth,brushHeight); } else if (this.targetGoblin.tool==='eraser'){ image(assets.sprites['empty_hand'],brush_hand_x+(10*scaleFactor),brush_hand_y,handSize,handSize); } noTint(); pop(); } else { fill(this.targetGoblin.color[0],this.targetGoblin.color[1],this.targetGoblin.color[2]); ellipse(spriteX,spriteY,spriteSize,spriteSize);} // arrows
  push(); noStroke(); fill(this.leftArrowHover?you.ui_color[0]:you.ui_color[0], this.leftArrowHover?you.ui_color[1]:you.ui_color[1], this.leftArrowHover?you.ui_color[2]:you.ui_color[2], this.leftArrowHover?255:160); triangle(spriteX-arrowOffset,spriteY,spriteX-arrowOffset+arrowSize,spriteY-arrowSize/2,spriteX-arrowOffset+arrowSize,spriteY+arrowSize/2); fill(this.rightArrowHover?you.ui_color[0]:you.ui_color[0], this.rightArrowHover?you.ui_color[1]:you.ui_color[1], this.rightArrowHover?you.ui_color[2]:you.ui_color[2], this.rightArrowHover?255:160); triangle(spriteX+arrowOffset,spriteY,spriteX+arrowOffset-arrowSize,spriteY-arrowSize/2,spriteX+arrowOffset-arrowSize,spriteY+arrowSize/2); pop();
  fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]); textAlign(LEFT,TOP); textSize(16); text('Choose Color:', this.x + this.colorStartX, this.y + 20); for (let i=0;i<this.colorPalette.length;i++){ const col=i%this.colorsPerRow; const row=Math.floor(i/this.colorsPerRow); const colorX=this.x+this.colorStartX+col*(this.colorSize+this.colorSpacing); const colorY=this.y+this.colorStartY+row*(this.colorSize+this.colorSpacing); const color=this.colorPalette[i]; fill(color[0],color[1],color[2]); if(i===this.hoveredColor){ stroke(255); strokeWeight(3);} else { noStroke(); } if(this.targetGoblin.color[0]===color[0]&&this.targetGoblin.color[1]===color[1]&&this.targetGoblin.color[2]===color[2]){ stroke(255,255,0); strokeWeight(4);} ellipse(colorX+this.colorSize/2,colorY+this.colorSize/2,this.colorSize,this.colorSize);} noStroke(); fill(you.ui_color[0],you.ui_color[1],you.ui_color[2]); const displayName=(this.targetGoblin.name&&this.targetGoblin.name.trim())?this.targetGoblin.name:`Player ${Math.round(this.targetGoblin.id)}`; text(displayName,this.x+20,this.y+20); textAlign(CENTER,BOTTOM); textSize(12); fill(you.ui_color[0],you.ui_color[1],you.ui_color[2],200); text('Press Escape or click outside to close', this.x+this.width/2,this.y+this.height-5); pop(); }
  cycleShape(dir){ if(this.targetGoblin!==you) return; const idx=this.shapes.indexOf(this.targetGoblin.shape); const next=(idx+dir+this.shapes.length)%this.shapes.length; this.targetGoblin.shape=this.shapes[next]; switch (this.targetGoblin.shape){ case 'hippo': this.targetGoblin.size=35; break; case 'blimp': case 'stanley': case 'grubby': this.targetGoblin.size=40; break; case 'ricky': this.targetGoblin.size=45; break; case 'manny': default: this.targetGoblin.size=50; } sendMessage({type:'update', g:{ i:this.targetGoblin.id, s:this.targetGoblin.shape }}); }
}

export default BasicProfileDisplay;

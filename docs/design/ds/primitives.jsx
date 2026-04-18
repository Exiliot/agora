// primitives.jsx — tokens + helpers + atoms for agora design system

// ---- token objects (mirrors :root CSS vars for JS-side reference) ----
const tokens = {
  color: {
    paper0:'#fbf9f4', paper1:'#f6f3ec', paper2:'#ede9df', paper3:'#e2ddcf',
    rule:'#d6d0be', ink0:'#1a1a17', ink1:'#3a3a34', ink2:'#6b6a60', ink3:'#9a988c',
    accent:'oklch(0.52 0.07 190)', accentSoft:'oklch(0.92 0.03 190)',
    accentInk:'oklch(0.34 0.06 190)',
    online:'oklch(0.62 0.14 145)', afk:'oklch(0.72 0.12 75)', offline:'#a8a49a',
    danger:'oklch(0.52 0.16 27)', dangerSoft:'oklch(0.93 0.04 27)',
    mentionBg:'oklch(0.93 0.05 85)', mentionFg:'oklch(0.36 0.08 55)',
  },
  space: [0,2,4,6,8,12,16,24,32,48,64],
  radius: {xs:2, sm:3, md:4},
  type: {
    sans:'"Inter", ui-sans-serif, system-ui, sans-serif',
    mono:'"IBM Plex Mono", ui-monospace, Menlo, monospace',
    serif:'"IBM Plex Serif", Georgia, serif',
  }
};

// ---- tiny helper: label over a sample block ----
function Row({children, gap=10, align='center', wrap=false, style={}}){
  return <div style={{display:'flex',gap,alignItems:align,flexWrap:wrap?'wrap':'nowrap',...style}}>{children}</div>;
}
function Col({children, gap=8, style={}}){
  return <div style={{display:'flex',flexDirection:'column',gap,...style}}>{children}</div>;
}
function Meta({children, style={}}){
  return <div style={{fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.4,
    textTransform:'uppercase',color:tokens.color.ink2,...style}}>{children}</div>;
}
function Divider({v=false, style={}}){
  return v
    ? <div style={{width:1,alignSelf:'stretch',background:tokens.color.rule,...style}}/>
    : <div style={{height:1,background:tokens.color.rule,...style}}/>;
}

// ---- Swatch: color chip w/ name + value ----
function Swatch({name, value, note, size=56, mono=true, textLight=false}){
  return (
    <Col gap={6} style={{width:size*2+8}}>
      <div style={{
        width:'100%',height:size,background:value,
        border:'1px solid rgba(0,0,0,.08)',borderRadius:tokens.radius.xs,
        display:'flex',alignItems:'flex-end',justifyContent:'flex-end',
        padding:6,color:textLight?'#fff':tokens.color.ink0,fontSize:10,
        fontFamily:tokens.type.mono,
      }}>
        {note||''}
      </div>
      <div>
        <div style={{fontSize:12,fontWeight:500,color:tokens.color.ink0}}>{name}</div>
        <div style={{fontSize:11,fontFamily:mono?tokens.type.mono:undefined,color:tokens.color.ink2}}>
          {value}
        </div>
      </div>
    </Col>
  );
}

// ---- Presence dot (flat square swatch, not glowing circle) ----
function Presence({status='online', label, size=9}){
  const fill = status==='online'?tokens.color.online
    : status==='afk'?tokens.color.afk
    : tokens.color.offline;
  // AFK uses a half-filled square; offline is outlined only — classic IRC cues
  const box = {
    width:size,height:size,display:'inline-block',verticalAlign:'middle',
    marginRight:6,flexShrink:0,
  };
  let swatch;
  if(status==='online') swatch=<span style={{...box,background:fill}}/>;
  else if(status==='afk') swatch=<span style={{...box,background:`linear-gradient(135deg, ${fill} 50%, transparent 50%)`,border:`1px solid ${fill}`}}/>;
  else swatch=<span style={{...box,background:'transparent',border:`1px solid ${fill}`}}/>;
  return <span style={{display:'inline-flex',alignItems:'center',fontFamily:tokens.type.mono,fontSize:12,color:tokens.color.ink1}}>
    {swatch}{label}
  </span>;
}

// ---- Button ----
function Button({children, variant='default', size='md', disabled, style={}, ...p}){
  const base = {
    fontFamily:tokens.type.sans, fontWeight:500,
    borderRadius:tokens.radius.xs,
    cursor:disabled?'not-allowed':'pointer',
    lineHeight:1, whiteSpace:'nowrap',
    transition:'background 80ms, border-color 80ms',
    opacity:disabled?.5:1,
  };
  const sizes = {
    sm:{fontSize:12, padding:'5px 10px'},
    md:{fontSize:13, padding:'7px 14px'},
    lg:{fontSize:14, padding:'10px 18px'},
  };
  const variants = {
    default:{ // the workhorse — beveled paper button
      background:'linear-gradient(180deg, #fdfaf1 0%, #f1ebda 100%)',
      border:`1px solid ${tokens.color.rule}`,
      color:tokens.color.ink0,
      boxShadow:'0 1px 0 rgba(255,255,255,.7) inset, 0 1px 0 rgba(0,0,0,.03)',
    },
    primary:{
      background:tokens.color.accent, color:'#fff',
      border:'1px solid '+tokens.color.accentInk,
      boxShadow:'0 1px 0 rgba(255,255,255,.12) inset',
    },
    ghost:{
      background:'transparent', color:tokens.color.ink0,
      border:'1px solid transparent',
    },
    link:{
      background:'transparent', color:tokens.color.accent,
      border:'1px solid transparent', padding:0,
      textDecoration:'underline', textUnderlineOffset:2,
    },
    danger:{
      background:'#fff', color:tokens.color.danger,
      border:`1px solid ${tokens.color.danger}`,
    },
  };
  return <button disabled={disabled} style={{...base,...sizes[size],...variants[variant],...style}} {...p}>{children}</button>;
}

// ---- Input ----
function Input({label, value, placeholder, hint, error, type='text', style={}, inputStyle={}, ...p}){
  return (
    <Col gap={4} style={{width:'100%',...style}}>
      {label && <label style={{fontSize:12, color:tokens.color.ink1, fontWeight:500}}>{label}</label>}
      <input
        type={type} defaultValue={value} placeholder={placeholder}
        style={{
          fontFamily:tokens.type.sans, fontSize:13,
          padding:'8px 10px',
          background:'#fff',
          border:`1px solid ${error?tokens.color.danger:tokens.color.rule}`,
          borderTop:`1px solid ${error?tokens.color.danger:'#bfb9a5'}`, // subtle inset
          borderRadius:tokens.radius.xs,
          color:tokens.color.ink0, outline:'none',
          boxShadow:'inset 0 1px 0 rgba(0,0,0,.04)',
          ...inputStyle,
        }}
        {...p}
      />
      {hint && <div style={{fontSize:11,color:error?tokens.color.danger:tokens.color.ink2}}>{hint}</div>}
    </Col>
  );
}

// ---- Checkbox / Radio (native styled) ----
function Check({label, checked, type='checkbox', name}){
  return (
    <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:tokens.color.ink0,cursor:'pointer'}}>
      <input type={type} defaultChecked={checked} name={name}
        style={{accentColor:tokens.color.accent,margin:0,width:13,height:13}}/>
      {label}
    </label>
  );
}

// ---- Badge / Chip ----
function Badge({children, tone='neutral', style={}}){
  const tones = {
    neutral:{bg:tokens.color.paper2, fg:tokens.color.ink1, bd:tokens.color.rule},
    accent: {bg:tokens.color.accentSoft, fg:tokens.color.accentInk, bd:'transparent'},
    danger: {bg:tokens.color.dangerSoft, fg:tokens.color.danger, bd:'transparent'},
    mention:{bg:tokens.color.mentionBg, fg:tokens.color.mentionFg, bd:'transparent'},
    private:{bg:'#efe9d8', fg:'#5a4a2a', bd:'transparent'},
  }[tone];
  return <span style={{
    display:'inline-flex',alignItems:'center',gap:4,
    padding:'2px 6px',
    background:tones.bg,color:tones.fg,border:`1px solid ${tones.bd}`,
    borderRadius:tokens.radius.xs,fontSize:11,fontFamily:tokens.type.mono,
    fontWeight:500,letterSpacing:.2,
    ...style
  }}>{children}</span>;
}

// ---- Avatar (deterministic initials, no photos — classic chat) ----
const avatarPalette = ['#b38b59','#6b8e6b','#8a6f9e','#a86a5c','#5d7d8f','#9a7b3f','#7a6a5c'];
function Avatar({name='?', size=20}){
  const ch = name[0]?.toUpperCase()||'?';
  const idx = name.charCodeAt(0)%avatarPalette.length;
  return <span style={{
    display:'inline-flex',alignItems:'center',justifyContent:'center',
    width:size,height:size,flexShrink:0,
    background:avatarPalette[idx],color:'#fff',
    fontFamily:tokens.type.mono,fontWeight:600,fontSize:Math.round(size*0.5),
    borderRadius:tokens.radius.xs,letterSpacing:0,
  }}>{ch}</span>;
}

// expose
Object.assign(window, {tokens, Row, Col, Meta, Divider, Swatch, Presence, Button, Input, Check, Badge, Avatar});

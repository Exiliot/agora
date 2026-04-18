// components.jsx — higher-order components for agora DS

// ---- MessageRow: the core of the product ----
function MessageRow({time='10:21', user='bob', color, self=false, children, mention=false, system=false, deleted=false, reply=null}){
  const userColor = color || '#7a6a5c';
  if(system) return (
    <div style={{fontFamily:tokens.type.mono,fontSize:12,color:tokens.color.ink2,padding:'2px 12px',fontStyle:'italic'}}>
      <span style={{color:tokens.color.ink3}}>[{time}]</span> {children}
    </div>
  );
  return (
    <div style={{
      display:'flex', gap:10, padding:'3px 12px',
      fontFamily:tokens.type.mono, fontSize:13, lineHeight:1.5,
      background: mention ? 'linear-gradient(90deg, rgba(240,210,120,.2), transparent 60%)' : undefined,
      borderLeft: mention ? `2px solid ${tokens.color.mentionFg}` : '2px solid transparent',
      opacity: deleted ? .4 : 1,
    }}>
      <span style={{color:tokens.color.ink3, flexShrink:0, userSelect:'none'}}>[{time}]</span>
      <div style={{minWidth:0, flex:1}}>
        {reply && (
          <div style={{
            fontSize:11, color:tokens.color.ink2, borderLeft:`2px solid ${tokens.color.rule}`,
            paddingLeft:6, marginBottom:2,
          }}>
            <span style={{color:reply.color||'#7a6a5c', fontWeight:600}}>↳ {reply.user}</span>: {reply.text}
          </div>
        )}
        <span style={{color:userColor, fontWeight:600, textDecoration: self?'underline':'none'}}>{user}{self?' (you)':''}</span>
        <span style={{color:tokens.color.ink2}}>: </span>
        <span style={{color: deleted ? tokens.color.ink3 : tokens.color.ink0}}>{deleted ? <i>message deleted</i> : children}</span>
      </div>
    </div>
  );
}

// ---- FileCard: inline in a message ----
function FileCard({name='spec-v3.pdf', size='284 KB', kind='pdf', comment, img}){
  if(img) return (
    <div style={{
      display:'inline-block',margin:'4px 0',
      border:`1px solid ${tokens.color.rule}`, background:'#fff', padding:4, maxWidth:280,
    }}>
      <div style={{height:140,background:
        `repeating-linear-gradient(45deg, ${tokens.color.paper2} 0 8px, ${tokens.color.paper1} 8px 16px)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2
      }}>[image preview]</div>
      <div style={{padding:'4px 2px 0',fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>
        {name} · {size}
      </div>
    </div>
  );
  return (
    <div style={{
      display:'inline-flex',alignItems:'stretch',margin:'4px 0',
      border:`1px solid ${tokens.color.rule}`, background:'#fff',
      maxWidth:360,
    }}>
      <div style={{
        width:40, background:tokens.color.paper2, display:'flex',
        alignItems:'center',justifyContent:'center',
        fontFamily:tokens.type.mono, fontSize:10, fontWeight:600,
        color:tokens.color.ink1, borderRight:`1px solid ${tokens.color.rule}`,
        letterSpacing:.5,
      }}>{kind.toUpperCase()}</div>
      <div style={{padding:'6px 10px',display:'flex',flexDirection:'column',justifyContent:'center',minWidth:0}}>
        <div style={{fontFamily:tokens.type.mono,fontSize:12,color:tokens.color.accent,textDecoration:'underline',textUnderlineOffset:2}}>{name}</div>
        <div style={{fontSize:11,color:tokens.color.ink2}}>
          {size}{comment?` — ${comment}`:''}
        </div>
      </div>
    </div>
  );
}

// ---- RoomListItem ----
function RoomListItem({name, type='#', unread, active, private:priv, muted, locked}){
  const prefix = priv ? '🔒' : '#';
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:4,
      padding:'3px 10px 3px 16px',
      background: active ? tokens.color.accentSoft : 'transparent',
      borderLeft: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
      fontFamily:tokens.type.mono,fontSize:13,
      color: active ? tokens.color.accentInk : (muted?tokens.color.ink2:tokens.color.ink0),
      cursor:'pointer',
    }}>
      <span style={{color:tokens.color.ink2,width:12,textAlign:'center',fontSize:11}}>
        {priv?'•':'#'}
      </span>
      <span style={{flex:1, textDecoration: muted?'line-through':'none', opacity: muted?.6:1}}>{name}</span>
      {unread>0 && <span style={{
        fontSize:10, minWidth:18, height:15,
        padding:'0 5px', display:'inline-flex',alignItems:'center',justifyContent:'center',
        background:tokens.color.mentionFg, color:'#fff', borderRadius:2, fontWeight:600
      }}>{unread}</span>}
    </div>
  );
}

// ---- ContactListItem ----
function ContactListItem({name, status='online', unread, nick}){
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:6,
      padding:'3px 10px 3px 16px',
      fontFamily:tokens.type.mono,fontSize:13,
      color: status==='offline' ? tokens.color.ink2 : tokens.color.ink0,
      cursor:'pointer',
    }}>
      <span style={{width:9,height:9,display:'inline-block',flexShrink:0,
        background: status==='online'?tokens.color.online:(status==='afk'?'transparent':'transparent'),
        border: status!=='online' ? `1px solid ${status==='afk'?tokens.color.afk:tokens.color.offline}` : 'none',
        backgroundImage: status==='afk' ? `linear-gradient(135deg, ${tokens.color.afk} 50%, transparent 50%)` : undefined,
      }}/>
      <span style={{flex:1}}>{name}</span>
      {unread>0 && <Badge tone="mention">{unread}</Badge>}
    </div>
  );
}

// ---- Nav tab (top nav) ----
function NavTab({children, active, danger}){
  return <span style={{
    display:'inline-flex',alignItems:'center',gap:6,
    padding:'10px 14px',
    fontFamily:tokens.type.sans, fontSize:13, fontWeight: active?600:500,
    color: danger ? tokens.color.danger : (active ? tokens.color.ink0 : tokens.color.ink1),
    borderBottom: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
    cursor:'pointer',
  }}>{children}</span>;
}

// ---- Tab bar (inside modals) ----
function TabBar({items, active=0}){
  return (
    <div style={{display:'flex',borderBottom:`1px solid ${tokens.color.rule}`}}>
      {items.map((t,i)=>(
        <div key={i} style={{
          padding:'8px 14px',
          fontFamily:tokens.type.sans,fontSize:12,fontWeight:500,
          color: i===active?tokens.color.ink0:tokens.color.ink2,
          borderBottom: i===active?`2px solid ${tokens.color.accent}`:'2px solid transparent',
          marginBottom:-1, cursor:'pointer',
        }}>{t}</div>
      ))}
    </div>
  );
}

// ---- Table (for moderation lists) ----
function Table({cols, rows}){
  return (
    <table style={{
      width:'100%',borderCollapse:'collapse',
      fontFamily:tokens.type.sans,fontSize:12,
    }}>
      <thead>
        <tr>
          {cols.map((c,i)=><th key={i} style={{
            textAlign:'left',padding:'6px 10px',
            fontWeight:600,color:tokens.color.ink2,
            fontFamily:tokens.type.mono,fontSize:10,textTransform:'uppercase',letterSpacing:.5,
            borderBottom:`1px solid ${tokens.color.rule}`,
            background:tokens.color.paper1,
          }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i)=>(
          <tr key={i} style={{borderBottom:`1px solid ${tokens.color.paper2}`}}>
            {r.map((cell,j)=><td key={j} style={{padding:'6px 10px',color:tokens.color.ink0,verticalAlign:'middle'}}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- Modal frame (dialog card) ----
function Modal({title, children, width=420, onClose}){
  return (
    <div style={{
      width, background:'#fff',
      border:`1px solid ${tokens.color.rule}`,
      borderRadius:tokens.radius.sm,
      boxShadow:'0 4px 16px rgba(0,0,0,.08), 0 1px 0 rgba(255,255,255,.6) inset',
      overflow:'hidden',
    }}>
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'9px 12px',
        background:'linear-gradient(180deg, #f6f1df 0%, #ede7d1 100%)',
        borderBottom:`1px solid ${tokens.color.rule}`,
        fontFamily:tokens.type.sans,fontSize:12,fontWeight:600,color:tokens.color.ink0,
        letterSpacing:.1,
      }}>
        <span>{title}</span>
        <span style={{fontFamily:tokens.type.mono,color:tokens.color.ink2,cursor:'pointer',fontSize:14}}>×</span>
      </div>
      <div style={{padding:16}}>{children}</div>
    </div>
  );
}

// ---- Toast / system notice ----
function Toast({tone='info', title, children}){
  const tones = {
    info:{bd:tokens.color.rule, bg:'#fffef6', fg:tokens.color.ink0},
    success:{bd:tokens.color.online, bg:'#f1f8ef', fg:'#2a4a2a'},
    warn:{bd:tokens.color.afk, bg:'#fbf5e4', fg:'#5a4a2a'},
    error:{bd:tokens.color.danger, bg:tokens.color.dangerSoft, fg:'#6b2a20'},
  }[tone];
  return (
    <div style={{
      border:`1px solid ${tones.bd}`, borderLeft:`3px solid ${tones.bd}`,
      background:tones.bg, color:tones.fg,
      padding:'8px 12px', fontFamily:tokens.type.sans, fontSize:12,
      borderRadius:tokens.radius.xs, minWidth:260,
    }}>
      {title && <div style={{fontWeight:600, marginBottom:2}}>{title}</div>}
      {children}
    </div>
  );
}

// ---- Composer (message input) ----
function Composer({replyTo}){
  return (
    <div style={{
      border:`1px solid ${tokens.color.rule}`, background:'#fff',
      borderRadius:tokens.radius.xs,
    }}>
      {replyTo && (
        <div style={{
          display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'4px 10px',background:tokens.color.paper1,
          fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink1,
          borderBottom:`1px solid ${tokens.color.rule}`,
        }}>
          <span>↳ Replying to <b style={{color:tokens.color.accentInk}}>{replyTo}</b></span>
          <span style={{color:tokens.color.ink2,cursor:'pointer'}}>×</span>
        </div>
      )}
      <div style={{
        padding:'10px 12px',fontFamily:tokens.type.mono,fontSize:13,
        color:tokens.color.ink3,minHeight:48,
      }}>Type a message…</div>
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'6px 8px',borderTop:`1px solid ${tokens.color.paper2}`,
      }}>
        <Row gap={4}>
          <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>📎 attach</Button>
          <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>B I /code</Button>
        </Row>
        <Row gap={6}>
          <span style={{fontSize:11,color:tokens.color.ink3,fontFamily:tokens.type.mono}}>⏎ send · ⇧⏎ newline</span>
          <Button variant="primary" size="sm">Send</Button>
        </Row>
      </div>
    </div>
  );
}

Object.assign(window, {MessageRow, FileCard, RoomListItem, ContactListItem, NavTab, TabBar, Table, Modal, Toast, Composer});

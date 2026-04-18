// chrome.jsx — shared chrome: app shell, top nav, sample data

const U = {
  bob:   {name:'bob',   color:'#8a6f9e'},
  alice: {name:'alice', color:'#b38b59'},
  carol: {name:'carol', color:'#6b8e6b'},
  dave:  {name:'dave',  color:'#a86a5c'},
  mike:  {name:'mike',  color:'#5d7d8f'},
  eve:   {name:'eve',   color:'#9a7b3f'},
  you:   {name:'you',   color:'#5d7d8f'},
};

function Wordmark({size=22, dark}){
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
      <div style={{
        width:size,height:size,
        background:dark?tokens.color.paper0:tokens.color.ink0,
        color:dark?tokens.color.ink0:tokens.color.paper0,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontFamily:tokens.type.serif,fontWeight:600,fontSize:Math.round(size*0.75),
        borderRadius:tokens.radius.xs,fontStyle:'italic',
      }}>a</div>
      <span style={{fontFamily:tokens.type.serif,fontSize:size*0.85,fontWeight:500,letterSpacing:.5,
        color:dark?tokens.color.paper0:tokens.color.ink0}}>agora</span>
    </div>
  );
}

function AuthChrome({children}){
  // Slim top bar: wordmark + sign-in/register links
  return (
    <div style={{height:'100%',background:tokens.color.paper1,display:'flex',flexDirection:'column'}}>
      <div style={{
        height:48,borderBottom:`1px solid ${tokens.color.rule}`,
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'0 20px',background:tokens.color.paper0,
      }}>
        <Wordmark/>
        <Row gap={4}>
          <Button variant="link" size="sm">Sign in</Button>
          <span style={{color:tokens.color.ink3}}>·</span>
          <Button variant="link" size="sm">Register</Button>
        </Row>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'28px 20px'}}>
        {children}
      </div>
      <div style={{
        height:36,borderTop:`1px solid ${tokens.color.rule}`,
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'0 20px',background:tokens.color.paper0,
        fontFamily:tokens.type.mono,fontSize:10,color:tokens.color.ink2,letterSpacing:.4,
      }}>
        <span>AGORA.CHAT · v0.1</span>
        <span>300 online · 12 rooms</span>
      </div>
    </div>
  );
}

function AppChrome({active='Public rooms', you='alice', children}){
  return (
    <div style={{height:'100%',background:tokens.color.paper1,display:'flex',flexDirection:'column'}}>
      <div style={{
        display:'flex',alignItems:'center',
        background:tokens.color.paper1,
        borderBottom:`1px solid ${tokens.color.rule}`,
        paddingLeft:14,paddingRight:14,height:46,flexShrink:0,
      }}>
        <Wordmark size={20}/>
        <div style={{width:20}}/>
        {['Public rooms','Private rooms','Contacts','Sessions'].map(n=>
          <NavTab key={n} active={active===n}>{n}</NavTab>
        )}
        <div style={{flex:1}}/>
        <Row gap={6} style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>
          <span style={{width:7,height:7,background:tokens.color.online,display:'inline-block'}}/>
          connected
        </Row>
        <div style={{width:14}}/>
        <NavTab active={active==='Profile'}>
          <Avatar name={you} size={18}/>
          <span style={{marginLeft:2}}>{you} ▾</span>
        </NavTab>
      </div>
      <div style={{flex:1,display:'flex',minHeight:0}}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {U, Wordmark, AuthChrome, AppChrome});

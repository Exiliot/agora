// sessions.jsx — sessions view + confirm-revoke dialog + file-too-large state

function SessionsScreen(){
  const sessions = [
    {device:'Firefox · macOS',   ip:'10.4.2.15',    loc:'Berlin, DE',  seen:'now',         current:true},
    {device:'Safari · iPhone',    ip:'10.4.2.84',    loc:'Berlin, DE',  seen:'3 min ago',   current:false},
    {device:'Chrome · Windows',   ip:'92.51.18.201', loc:'Paris, FR',   seen:'yesterday',   current:false},
    {device:'Firefox · Linux',    ip:'37.120.4.6',   loc:'Amsterdam, NL', seen:'3 days ago', current:false},
  ];
  return (
    <AppChrome active="Sessions" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,overflow:'auto',background:tokens.color.paper1,padding:'24px 28px'}}>
        <Row style={{alignItems:'flex-end',justifyContent:'space-between',marginBottom:14}}>
          <Col gap={2}>
            <div style={{fontFamily:tokens.type.serif,fontSize:22,fontWeight:500}}>Sessions</div>
            <div style={{fontFamily:tokens.type.sans,fontSize:12,color:tokens.color.ink2,maxWidth:540,lineHeight:1.5}}>
              Every browser you've signed in from has its own session. Revoke anything that looks wrong.
            </div>
          </Col>
          <Button variant="danger">Sign out all others</Button>
        </Row>

        <div style={{background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:3,overflow:'hidden'}}>
          {sessions.map((s,i)=>(
            <div key={i} style={{
              display:'flex',alignItems:'center',gap:16,padding:'14px 16px',
              borderBottom:i<sessions.length-1?`1px solid ${tokens.color.paper2}`:'none',
              background: s.current ? tokens.color.accentSoft : '#fff',
            }}>
              <div style={{
                width:38,height:38,flexShrink:0,
                background:tokens.color.paper2,border:`1px solid ${tokens.color.rule}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:tokens.type.mono,fontSize:10,color:tokens.color.ink1,
                borderRadius:tokens.radius.xs,
              }}>{s.device.split(' · ')[0].slice(0,2).toUpperCase()}</div>
              <Col gap={3} style={{flex:1,minWidth:0}}>
                <Row gap={8}>
                  <span style={{fontFamily:tokens.type.sans,fontSize:13,fontWeight:600}}>{s.device}</span>
                  {s.current && <Badge tone="accent">this session</Badge>}
                </Row>
                <Row gap={12} style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>
                  <span>{s.ip}</span>
                  <span>·</span>
                  <span>{s.loc}</span>
                  <span>·</span>
                  <span>last seen {s.seen}</span>
                </Row>
              </Col>
              {s.current
                ? <Button size="sm" disabled>Current</Button>
                : <Button size="sm" variant="danger">Revoke</Button>}
            </div>
          ))}
        </div>

        <div style={{height:18}}/>
        <Toast tone="info" title="Sessions are server-side">
          Revoking a session disconnects any WebSocket immediately. It takes up to 2 seconds for presence to update.
        </Toast>
      </div>
    </AppChrome>
  );
}

function RevokeConfirmModal(){
  return (
    <Modal title="Revoke session" width={400}>
      <Col gap={12}>
        <div style={{fontSize:13,color:tokens.color.ink1,lineHeight:1.55}}>
          This will sign out <b>Chrome · Windows</b> (Paris, FR) immediately. Any file uploads in progress will be cancelled.
        </div>
        <div style={{
          background:tokens.color.paper1,border:`1px solid ${tokens.color.rule}`,
          padding:'8px 12px',borderRadius:tokens.radius.xs,
          fontFamily:tokens.type.mono,fontSize:12,color:tokens.color.ink1,
        }}>
          <div>device · Chrome · Windows</div>
          <div>ip · 92.51.18.201</div>
          <div>last seen · yesterday 21:14</div>
        </div>
        <Row gap={8} style={{justifyContent:'flex-end'}}>
          <Button>Cancel</Button>
          <Button variant="danger">Revoke session</Button>
        </Row>
      </Col>
    </Modal>
  );
}

function UploadLimitScreen(){
  return (
    <AppChrome active="Public rooms" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#fff'}}>
        <RoomHeader/>
        <div style={{flex:1,overflow:'auto',padding:'10px 0'}}>
          <MessageRow time="10:41" user="bob" color={U.bob.color}>sending the trace file</MessageRow>
        </div>
        <div style={{padding:12,borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper0}}>
          <Col gap={8}>
            <Toast tone="error" title="File too large">
              <b>dump.log</b> is 34.2&nbsp;MB. Files are capped at 20&nbsp;MB; images at 3&nbsp;MB. <Button variant="link" style={{padding:0,fontSize:12}}>Use an external link instead</Button>.
            </Toast>
            <Composer/>
          </Col>
        </div>
      </div>
      <RightSidebar/>
    </AppChrome>
  );
}

function ReconnectingScreen(){
  return (
    <AppChrome active="Public rooms" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#fff',position:'relative'}}>
        <RoomHeader/>
        <div style={{
          background:'oklch(0.96 0.04 75)',borderBottom:`1px solid ${tokens.color.afk}`,
          padding:'6px 16px',fontFamily:tokens.type.mono,fontSize:12,color:'#5a4a2a',
          display:'flex',alignItems:'center',gap:10,
        }}>
          <span style={{width:8,height:8,background:tokens.color.afk,display:'inline-block',animation:'pulse 1s infinite'}}/>
          Reconnecting… · retry 2 of 6 · next in 2s
          <div style={{flex:1}}/>
          <Button size="sm" variant="ghost" style={{fontFamily:tokens.type.mono}}>Retry now</Button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'10px 0',opacity:.7}}>
          <MessageRow time="10:41" user="bob" color={U.bob.color}>looks good, merging</MessageRow>
          <MessageRow time="10:42" user="you" self color={U.you.color}>
            <span style={{opacity:.6}}>great — let me test locally first</span>
            <span style={{fontSize:11,color:tokens.color.ink3,marginLeft:6,fontFamily:tokens.type.mono}}>(sending…)</span>
          </MessageRow>
        </div>
        <div style={{padding:'8px 12px',borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper0}}>
          <Composer/>
        </div>
      </div>
      <RightSidebar/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </AppChrome>
  );
}

Object.assign(window, {SessionsScreen, RevokeConfirmModal, UploadLimitScreen, ReconnectingScreen});

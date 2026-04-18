// app.jsx — lays out all screens on the design canvas

const W = 1180; // desktop width per artboard
const H = 740;

function Frame({label, children, w=W, h=H}){
  return (
    <DCArtboard label={label} width={w} height={h} style={{background:'#fff'}}>
      <div style={{width:w,height:h,overflow:'hidden'}}>{children}</div>
    </DCArtboard>
  );
}

function ModalFrame({label, children, w=720, h=560}){
  return (
    <DCArtboard label={label} width={w} height={h} style={{background:'#f0eee9',border:`1px solid ${tokens.color.rule}`}}>
      <div style={{
        width:w,height:h,padding:24,background:
          `repeating-linear-gradient(0deg, #f0eee9 0 23px, #e8e5db 23px 24px),
           repeating-linear-gradient(90deg, #f0eee9 0 23px, #e8e5db 23px 24px)`,
        display:'flex',alignItems:'flex-start',justifyContent:'center',overflow:'auto',
      }}>{children}</div>
    </DCArtboard>
  );
}

function App(){
  return (
    <DesignCanvas>
      <div style={{padding:'20px 60px 30px',maxWidth:1200}}>
        <Wordmark size={46}/>
        <div style={{fontFamily:tokens.type.sans,fontSize:14,color:tokens.color.ink2,marginTop:12,maxWidth:720,lineHeight:1.55}}>
          Screen iterations for <b style={{color:tokens.color.ink0}}>agora</b>. Each artboard is a 1180×740 desktop frame (or a centered dialog). Pan & zoom with trackpad / mouse.
        </div>
        <Row gap={8} style={{marginTop:14}} wrap>
          <Badge>Auth</Badge>
          <Badge>Main chat</Badge>
          <Badge>Browse</Badge>
          <Badge>DMs</Badge>
          <Badge>Manage room (5 tabs)</Badge>
          <Badge>Sessions</Badge>
          <Badge>Profile</Badge>
          <Badge>Edge states</Badge>
        </Row>
      </div>

      <DCSection title="Auth" subtitle="Centered dialogs on the paper background. Slim top bar with wordmark; slim footer with server status.">
        <Frame label="Sign in" w={720} h={520}><SignInScreen/></Frame>
        <Frame label="Register" w={720} h={520}><RegisterScreen/></Frame>
        <Frame label="Forgot password" w={720} h={520}><ForgotScreen/></Frame>
        <Frame label="Reset password" w={720} h={520}><ResetScreen/></Frame>
      </DCSection>

      <DCSection title="Main chat" subtitle="Three-column: rooms sidebar · message river · room context. Chat content is mono; chrome is sans.">
        <Frame label="#engineering — active conversation"><MainChatScreen/></Frame>
        <Frame label="Browse public rooms"><BrowseRoomsScreen/></Frame>
        <Frame label="Empty room"><EmptyRoomScreen/></Frame>
      </DCSection>

      <DCSection title="Direct messages" subtitle="Same layout, right panel becomes a one-person profile. Blocked DM is read-only.">
        <Frame label="DM with carol"><DMScreen/></Frame>
        <Frame label="DM frozen — blocked user"><BlockedDMScreen/></Frame>
      </DCSection>

      <DCSection title="Manage room" subtitle="All 5 tabs of the moderation dialog, shown on top of the chat so context is preserved.">
        <ModalFrame label="Members tab" h={560}><ManageRoomModal tab={0}/></ModalFrame>
        <ModalFrame label="Admins tab" h={460}><ManageRoomModal tab={1}/></ModalFrame>
        <ModalFrame label="Banned users" h={460}><ManageRoomModal tab={2}/></ModalFrame>
        <ModalFrame label="Invitations" h={460}><ManageRoomModal tab={3}/></ModalFrame>
        <ModalFrame label="Settings" h={560}><ManageRoomModal tab={4}/></ModalFrame>
      </DCSection>

      <DCSection title="Dialogs" subtitle="Create room, profile, revoke session confirmation.">
        <ModalFrame label="Create a room" w={540} h={540}><CreateRoomModal/></ModalFrame>
        <ModalFrame label="Profile" w={540} h={580}><ProfileModal/></ModalFrame>
        <ModalFrame label="Confirm revoke" w={540} h={400}><RevokeConfirmModal/></ModalFrame>
      </DCSection>

      <DCSection title="Sessions & edge states" subtitle="Sessions view (Denis's 'DB-backed, per-browser, revocable'), plus degraded states.">
        <Frame label="Sessions list"><SessionsScreen/></Frame>
        <Frame label="Reconnecting (WebSocket dropped)"><ReconnectingScreen/></Frame>
        <Frame label="Upload over the 20MB/3MB cap"><UploadLimitScreen/></Frame>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

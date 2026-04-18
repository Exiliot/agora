// modals.jsx — manage room modal (all 5 tabs), create room, invite, profile

function ManageRoomModal({tab=0}){
  const tabs = ['Members','Admins','Banned users','Invitations','Settings'];
  return (
    <Modal title="Manage room · #engineering-room" width={620}>
      <TabBar items={tabs} active={tab}/>
      <div style={{height:14}}/>
      {tab===0 && <MembersTab/>}
      {tab===1 && <AdminsTab/>}
      {tab===2 && <BannedTab/>}
      {tab===3 && <InvitationsTab/>}
      {tab===4 && <SettingsTab/>}
    </Modal>
  );
}

function MembersTab(){
  return (
    <Col gap={10}>
      <Row gap={8}>
        <Input placeholder="Search member…" inputStyle={{fontSize:12}} style={{flex:1}}/>
        <Button>Export list</Button>
      </Row>
      <Table
        cols={['Username','Status','Role','Actions']}
        rows={[
          [<Row gap={6}><Avatar name="alice" size={18}/>alice</Row>, <Presence status="online" label="online"/>, <Badge tone="accent">owner</Badge>, <span style={{color:tokens.color.ink3,fontFamily:tokens.type.mono,fontSize:11}}>—</span>],
          [<Row gap={6}><Avatar name="dave" size={18}/>dave</Row>, <Presence status="afk" label="AFK"/>, <Badge>admin</Badge>, <Row gap={4}><Button size="sm">Remove admin</Button><Button size="sm" variant="danger">Ban</Button></Row>],
          [<Row gap={6}><Avatar name="bob" size={18}/>bob</Row>, <Presence status="online" label="online"/>, <span style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>member</span>, <Row gap={4}><Button size="sm">Make admin</Button><Button size="sm">Remove</Button><Button size="sm" variant="danger">Ban</Button></Row>],
          [<Row gap={6}><Avatar name="carol" size={18}/>carol</Row>, <Presence status="offline" label="offline"/>, <span style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>member</span>, <Row gap={4}><Button size="sm">Make admin</Button><Button size="sm">Remove</Button><Button size="sm" variant="danger">Ban</Button></Row>],
        ]}
      />
      <div style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2,textAlign:'right'}}>38 members · showing 4</div>
    </Col>
  );
}

function AdminsTab(){
  return (
    <Col gap={10}>
      <div style={{fontSize:12,color:tokens.color.ink1,lineHeight:1.5}}>
        Admins can ban users, manage invitations, and edit room settings. The owner keeps admin rights permanently.
      </div>
      <div style={{border:`1px solid ${tokens.color.rule}`,borderRadius:tokens.radius.xs}}>
        <Row style={{padding:'8px 12px',borderBottom:`1px solid ${tokens.color.paper2}`,alignItems:'center'}}>
          <Avatar name="alice" size={18}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:13,marginLeft:6,flex:1}}>alice</div>
          <Badge tone="accent">owner</Badge>
          <span style={{fontSize:11,color:tokens.color.ink3,marginLeft:10}}>cannot lose admin rights</span>
        </Row>
        <Row style={{padding:'8px 12px',alignItems:'center'}}>
          <Avatar name="dave" size={18}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:13,marginLeft:6,flex:1}}>dave</div>
          <Button size="sm" variant="danger">Remove admin</Button>
        </Row>
      </div>
      <Row gap={8} style={{alignItems:'flex-end'}}>
        <Input label="Promote member to admin" placeholder="username" style={{flex:1}}/>
        <Button variant="primary">Promote</Button>
      </Row>
    </Col>
  );
}

function BannedTab(){
  return (
    <Col gap={10}>
      <Input placeholder="Search banned user…" inputStyle={{fontSize:12}}/>
      <Table
        cols={['Username','Banned by','Date / time','Reason','Actions']}
        rows={[
          ['mike', 'alice', <span style={{fontFamily:tokens.type.mono,fontSize:11}}>2026-04-18 13:25</span>, <span style={{fontSize:11,color:tokens.color.ink2}}>spam</span>, <Button size="sm">Unban</Button>],
          ['eve', 'dave', <span style={{fontFamily:tokens.type.mono,fontSize:11}}>2026-04-18 13:40</span>, <span style={{fontSize:11,color:tokens.color.ink2}}>harassment</span>, <Button size="sm">Unban</Button>],
        ]}
      />
      <Toast tone="info">Banned users lose room access and file history for this room. Personal DMs are unaffected.</Toast>
    </Col>
  );
}

function InvitationsTab(){
  return (
    <Col gap={10}>
      <Row gap={8} style={{alignItems:'flex-end'}}>
        <Input label="Invite by username" placeholder="e.g. frank" style={{flex:1}}/>
        <Button variant="primary">Send invite</Button>
      </Row>
      <Divider/>
      <Meta>Pending invitations · 2</Meta>
      <div style={{border:`1px solid ${tokens.color.rule}`,borderRadius:tokens.radius.xs}}>
        <Row style={{padding:'8px 12px',borderBottom:`1px solid ${tokens.color.paper2}`,alignItems:'center'}}>
          <Avatar name="frank" size={18}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:13,marginLeft:6,flex:1}}>frank</div>
          <span style={{fontSize:11,color:tokens.color.ink2,marginRight:10}}>sent 2h ago by alice</span>
          <Button size="sm" variant="danger">Revoke</Button>
        </Row>
        <Row style={{padding:'8px 12px',alignItems:'center'}}>
          <Avatar name="grace" size={18}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:13,marginLeft:6,flex:1}}>grace</div>
          <span style={{fontSize:11,color:tokens.color.ink2,marginRight:10}}>sent yesterday by dave</span>
          <Button size="sm" variant="danger">Revoke</Button>
        </Row>
      </div>
    </Col>
  );
}

function SettingsTab(){
  return (
    <Col gap={14}>
      <Input label="Room name" value="engineering-room"/>
      <Col gap={4}>
        <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Description</label>
        <textarea defaultValue="backend + frontend discussions" style={{
          fontFamily:tokens.type.sans,fontSize:13,padding:'8px 10px',
          border:`1px solid ${tokens.color.rule}`,borderRadius:tokens.radius.xs,
          minHeight:60,resize:'vertical',outline:'none',
        }}/>
      </Col>
      <Col gap={6}>
        <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Visibility</label>
        <Row gap={14}>
          <Check type="radio" name="vis" label="Public — anyone can join" checked/>
          <Check type="radio" name="vis" label="Private — invite-only"/>
        </Row>
      </Col>
      <Col gap={6}>
        <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Posting</label>
        <Row gap={14} wrap>
          <Check label="Allow file uploads" checked/>
          <Check label="Slow mode (5s between messages)"/>
          <Check label="Read-only for non-admins"/>
        </Row>
      </Col>
      <Divider/>
      <Row gap={8} style={{justifyContent:'space-between'}}>
        <Button variant="danger">Delete room</Button>
        <Row gap={8}>
          <Button>Cancel</Button>
          <Button variant="primary">Save changes</Button>
        </Row>
      </Row>
    </Col>
  );
}

function CreateRoomModal(){
  return (
    <Modal title="Create a room" width={440}>
      <Col gap={12}>
        <Input label="Room name" placeholder="engineering-room" hint="Lowercase, no spaces. Use - to separate words."/>
        <Col gap={4}>
          <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Description</label>
          <textarea placeholder="What's this room for?" style={{
            fontFamily:tokens.type.sans,fontSize:13,padding:'8px 10px',
            border:`1px solid ${tokens.color.rule}`,borderRadius:tokens.radius.xs,
            minHeight:60,resize:'vertical',outline:'none',
          }}/>
        </Col>
        <Col gap={6}>
          <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Visibility</label>
          <Row gap={14}>
            <Check type="radio" name="cv" label="Public" checked/>
            <Check type="radio" name="cv" label="Private"/>
          </Row>
        </Col>
        <Toast tone="info">You'll be the owner. You can add admins after creating.</Toast>
        <Row gap={8} style={{justifyContent:'flex-end'}}>
          <Button>Cancel</Button>
          <Button variant="primary">Create room</Button>
        </Row>
      </Col>
    </Modal>
  );
}

function ProfileModal(){
  return (
    <Modal title="Profile · alice" width={440}>
      <Col gap={14}>
        <Row gap={14}>
          <Avatar name="alice" size={56}/>
          <Col gap={4} style={{flex:1}}>
            <div style={{fontFamily:tokens.type.mono,fontSize:15,color:tokens.color.ink0}}>alice</div>
            <div style={{fontSize:12,color:tokens.color.ink2}}>alice@example.com</div>
            <Row gap={6}><Presence status="online" label="online"/><Badge>member since Mar 2026</Badge></Row>
          </Col>
        </Row>
        <Divider/>
        <Input label="Display username" value="alice"/>
        <Input label="Email" value="alice@example.com"/>
        <Col gap={6}>
          <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Presence</label>
          <Row gap={14}>
            <Check type="radio" name="p" label="Auto" checked/>
            <Check type="radio" name="p" label="Force AFK"/>
            <Check type="radio" name="p" label="Invisible"/>
          </Row>
        </Col>
        <Col gap={6}>
          <label style={{fontSize:12,fontWeight:500,color:tokens.color.ink1}}>Notifications</label>
          <Row gap={14} wrap>
            <Check label="Mentions (@you)" checked/>
            <Check label="DMs" checked/>
            <Check label="All room messages"/>
            <Check label="Desktop sound"/>
          </Row>
        </Col>
        <Divider/>
        <Row gap={8} style={{justifyContent:'space-between'}}>
          <Button variant="link">Change password…</Button>
          <Row gap={8}><Button>Cancel</Button><Button variant="primary">Save</Button></Row>
        </Row>
      </Col>
    </Modal>
  );
}

Object.assign(window, {ManageRoomModal, CreateRoomModal, ProfileModal});

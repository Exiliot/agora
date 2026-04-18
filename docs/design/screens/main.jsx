// main.jsx — main chat layout (3-column), plus DM and empty-state variants

const roomsPublic = [
  {name:'general', unread:3},
  {name:'engineering', active:true},
  {name:'random'},
  {name:'announcements', muted:true},
];
const roomsPrivate = [
  {name:'core-team', priv:true, unread:1},
  {name:'ops', priv:true},
];
const contacts = [
  {name:'alice', status:'online'},
  {name:'bob', status:'online'},
  {name:'carol', status:'afk', unread:2},
  {name:'dave', status:'afk'},
  {name:'mike', status:'offline'},
  {name:'eve', status:'offline'},
];

function LeftSidebar({mode='rooms'}){
  return (
    <div style={{
      width:240,background:tokens.color.paper1,
      borderRight:`1px solid ${tokens.color.rule}`,
      display:'flex',flexDirection:'column',flexShrink:0,
    }}>
      <div style={{padding:'10px 12px',borderBottom:`1px solid ${tokens.color.rule}`}}>
        <Input placeholder="Search rooms, people…" inputStyle={{fontSize:12,padding:'6px 8px'}}/>
      </div>
      <div style={{overflow:'auto',flex:1,paddingBottom:8}}>
        <div style={{padding:'10px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2,display:'flex',justifyContent:'space-between'}}>
          <span>Public rooms</span><span style={{cursor:'pointer',color:tokens.color.accent}}>+</span>
        </div>
        {roomsPublic.map(r=><RoomListItem key={r.name} {...r}/>)}
        <div style={{padding:'10px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2,display:'flex',justifyContent:'space-between'}}>
          <span>Private rooms</span><span style={{cursor:'pointer',color:tokens.color.accent}}>+</span>
        </div>
        {roomsPrivate.map(r=><RoomListItem key={r.name} {...r}/>)}
        <div style={{padding:'10px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2,display:'flex',justifyContent:'space-between'}}>
          <span>Contacts</span><span style={{cursor:'pointer',color:tokens.color.accent}}>+</span>
        </div>
        {contacts.map(c=><ContactListItem key={c.name} {...c}/>)}
      </div>
      <div style={{padding:10,borderTop:`1px solid ${tokens.color.rule}`,display:'flex',gap:6}}>
        <Button size="sm" style={{flex:1}}>+ Room</Button>
        <Button size="sm" style={{flex:1}}>+ Contact</Button>
      </div>
    </div>
  );
}

function RightSidebar({title='Room info', type='public', owner='alice', admins=['alice','dave'], members=38, online=12, description='backend + frontend discussions'}){
  return (
    <div style={{
      width:240,background:tokens.color.paper0,
      borderLeft:`1px solid ${tokens.color.rule}`,
      display:'flex',flexDirection:'column',flexShrink:0,
    }}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${tokens.color.rule}`,fontFamily:tokens.type.sans,fontSize:12,fontWeight:600}}>
        {title}
      </div>
      <div style={{overflow:'auto',flex:1,padding:'10px 14px',fontFamily:tokens.type.sans,fontSize:12}}>
        <Row gap={4} style={{marginBottom:8}}>
          <Badge tone={type==='private'?'private':'neutral'}>{type}</Badge>
          <Badge>{members} members</Badge>
        </Row>
        <div style={{color:tokens.color.ink1,lineHeight:1.5,marginBottom:12}}>{description}</div>
        <Meta>Owner</Meta>
        <Row gap={6} style={{margin:'4px 0 12px'}}><Avatar name={owner} size={18}/><span style={{fontFamily:tokens.type.mono,fontSize:12}}>{owner}</span></Row>
        <Meta>Admins ({admins.length})</Meta>
        <Col gap={4} style={{margin:'4px 0 12px',fontFamily:tokens.type.mono,fontSize:12}}>
          {admins.map(a=>(<Row key={a} gap={6}><Avatar name={a} size={16}/><span>{a}</span></Row>))}
        </Col>
        <Meta>Online now · {online}</Meta>
        <Col gap={3} style={{margin:'4px 0 12px'}}>
          <Presence status="online" label="alice"/>
          <Presence status="online" label="bob"/>
          <Presence status="online" label="you"/>
          <Presence status="afk" label="carol"/>
          <Presence status="afk" label="dave"/>
        </Col>
        <Meta>Offline · 26</Meta>
        <Col gap={3} style={{margin:'4px 0 12px'}}>
          <Presence status="offline" label="mike"/>
          <Presence status="offline" label="eve"/>
          <Presence status="offline" label="frank"/>
          <div style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink3,paddingLeft:15}}>+ 23 more…</div>
        </Col>
      </div>
      <div style={{padding:10,borderTop:`1px solid ${tokens.color.rule}`,display:'flex',flexDirection:'column',gap:6}}>
        <Button size="sm">Invite user</Button>
        <Button size="sm">Manage room</Button>
        <Button size="sm" variant="danger">Leave room</Button>
      </div>
    </div>
  );
}

function RoomHeader({name='engineering', topic='backend + frontend discussions', priv=false}){
  return (
    <div style={{
      padding:'10px 16px',borderBottom:`1px solid ${tokens.color.rule}`,
      background:tokens.color.paper0,display:'flex',alignItems:'center',gap:10,flexShrink:0,
    }}>
      <div style={{fontFamily:tokens.type.sans,fontSize:14,fontWeight:600}}>
        <span style={{color:tokens.color.ink2,marginRight:4}}>{priv?'🔒':'#'}</span>{name}
      </div>
      <div style={{width:1,height:16,background:tokens.color.rule}}/>
      <div style={{fontFamily:tokens.type.sans,fontSize:12,color:tokens.color.ink2,flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{topic}</div>
      <Row gap={4}>
        <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>pin</Button>
        <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>search</Button>
        <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>⋯</Button>
      </Row>
    </div>
  );
}

function ChatStream(){
  return (
    <div style={{flex:1,overflow:'auto',background:'#fff',padding:'10px 0 4px'}}>
      <div style={{textAlign:'center',padding:'12px 0',fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink3}}>
        ──────── Wed, Apr 15 ────────
      </div>
      <MessageRow time="09:58" system>alice created the room</MessageRow>
      <MessageRow time="10:02" system>bob, carol, dave joined</MessageRow>
      <MessageRow time="10:21" user="bob" color={U.bob.color}>Hello team 👋</MessageRow>
      <MessageRow time="10:22" user="alice" color={U.alice.color}>morning — pushing the spec in a sec</MessageRow>
      <MessageRow time="10:23" user="you" self color={U.you.color}>
        <FileCard name="spec-v3.pdf" size="284 KB" kind="pdf" comment="latest requirements"/>
      </MessageRow>
      <MessageRow time="10:25" user="carol" color={U.carol.color}
        reply={{user:'bob',color:U.bob.color,text:'Hello team'}}>
        Can we make this private? there's customer data in the file
      </MessageRow>
      <MessageRow time="10:26" user="alice" color={U.alice.color}>good call, switching</MessageRow>
      <MessageRow time="10:27" system>alice changed the room to private</MessageRow>
      <MessageRow time="10:31" user="dave" color={U.dave.color}>
        <span style={{background:tokens.color.mentionBg,color:tokens.color.mentionFg,padding:'0 3px',borderRadius:2}}>@you</span> can you review the auth diff?
      </MessageRow>
      <MessageRow time="10:32" user="you" self mention color={U.you.color}>on it. sending screenshots</MessageRow>
      <MessageRow time="10:32" user="you" self color={U.you.color}>
        <FileCard img name="auth-flow.png" size="1.2 MB"/>
      </MessageRow>
      <div style={{textAlign:'center',padding:'10px 0',fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.accent}}>
        ──────── new messages ────────
      </div>
      <MessageRow time="10:41" user="bob" color={U.bob.color}>looks good, merging</MessageRow>
      <div style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink3,padding:'4px 12px'}}>alice is typing…</div>
    </div>
  );
}

function MainChatScreen(){
  return (
    <AppChrome active="Public rooms" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:'#fff'}}>
        <RoomHeader/>
        <ChatStream/>
        <div style={{padding:'8px 12px',borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper0}}>
          <Composer replyTo="dave"/>
        </div>
      </div>
      <RightSidebar/>
    </AppChrome>
  );
}

function DMScreen(){
  return (
    <AppChrome active="Contacts" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:'#fff'}}>
        <div style={{
          padding:'10px 16px',borderBottom:`1px solid ${tokens.color.rule}`,
          background:tokens.color.paper0,display:'flex',alignItems:'center',gap:10,
        }}>
          <Avatar name="carol" size={20}/>
          <div style={{fontFamily:tokens.type.sans,fontSize:14,fontWeight:600}}>carol</div>
          <Presence status="afk" label="AFK · last seen 4m ago"/>
          <div style={{flex:1}}/>
          <Button variant="ghost" size="sm" style={{fontFamily:tokens.type.mono,color:tokens.color.ink2}}>block</Button>
        </div>
        <div style={{flex:1,overflow:'auto',background:'#fff',padding:'10px 0'}}>
          <MessageRow time="Yesterday 17:40" system>beginning of conversation with carol</MessageRow>
          <MessageRow time="17:41" user="carol" color={U.carol.color}>hey — got a sec to look at the mock?</MessageRow>
          <MessageRow time="17:45" user="you" self color={U.you.color}>sure, share it</MessageRow>
          <MessageRow time="09:02" user="carol" color={U.carol.color}>
            <FileCard img name="dash-mock.png" size="2.1 MB"/>
          </MessageRow>
          <MessageRow time="09:14" user="you" self color={U.you.color}>looks great, ship it</MessageRow>
        </div>
        <div style={{padding:'8px 12px',borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper0}}>
          <Composer/>
        </div>
      </div>
      <div style={{width:240,background:tokens.color.paper0,borderLeft:`1px solid ${tokens.color.rule}`,padding:14}}>
        <div style={{fontFamily:tokens.type.sans,fontSize:12,fontWeight:600,marginBottom:10}}>About carol</div>
        <Row gap={10} style={{marginBottom:12}}>
          <Avatar name="carol" size={48}/>
          <Col gap={2}>
            <div style={{fontFamily:tokens.type.mono,fontSize:13}}>carol</div>
            <Presence status="afk" label="AFK"/>
            <div style={{fontSize:11,color:tokens.color.ink2}}>member since Mar 2026</div>
          </Col>
        </Row>
        <Meta>Shared rooms · 3</Meta>
        <Col gap={3} style={{margin:'4px 0 12px',fontFamily:tokens.type.mono,fontSize:12}}>
          <span># engineering</span><span># general</span><span>🔒 core-team</span>
        </Col>
        <Col gap={6}>
          <Button size="sm">Add to room…</Button>
          <Button size="sm" variant="danger">Block user</Button>
        </Col>
      </div>
    </AppChrome>
  );
}

function BlockedDMScreen(){
  return (
    <AppChrome active="Contacts" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:'#fff'}}>
        <div style={{
          padding:'10px 16px',borderBottom:`1px solid ${tokens.color.rule}`,
          background:tokens.color.paper0,display:'flex',alignItems:'center',gap:10,
        }}>
          <Avatar name="eve" size={20}/>
          <div style={{fontFamily:tokens.type.sans,fontSize:14,fontWeight:600}}>eve</div>
          <Badge tone="danger">blocked</Badge>
          <div style={{flex:1}}/>
        </div>
        <div style={{flex:1,overflow:'auto',background:'#fff',padding:'10px 0',opacity:.6}}>
          <MessageRow time="Mon 14:12" user="eve" color={U.eve.color}>hey there</MessageRow>
          <MessageRow time="Mon 14:20" user="you" self color={U.you.color}>hi</MessageRow>
          <MessageRow time="Mon 14:22" user="eve" color={U.eve.color}>long message that was the straw…</MessageRow>
          <MessageRow time="Mon 14:25" system>you blocked eve · conversation frozen</MessageRow>
        </div>
        <div style={{padding:12,borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper1}}>
          <Toast tone="warn" title="You blocked this user">
            History is read-only. New messages are disabled until you <Button variant="link" style={{padding:0,fontSize:12}}>unblock</Button>.
          </Toast>
        </div>
      </div>
    </AppChrome>
  );
}

function EmptyRoomScreen(){
  return (
    <AppChrome active="Public rooms" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#fff'}}>
        <RoomHeader name="random" topic="off-topic chatter"/>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
          <Col gap={10} style={{alignItems:'center',maxWidth:380,textAlign:'center'}}>
            <div style={{fontFamily:tokens.type.serif,fontSize:22,fontWeight:500}}>It's quiet in here</div>
            <div style={{fontFamily:tokens.type.sans,fontSize:13,color:tokens.color.ink2,lineHeight:1.5}}>
              Nobody has posted in <b>#random</b> yet. Say hello — others will be notified.
            </div>
            <Row gap={8} style={{marginTop:8}}>
              <Button>Invite someone</Button>
              <Button variant="primary">Post first message</Button>
            </Row>
          </Col>
        </div>
        <div style={{padding:'8px 12px',borderTop:`1px solid ${tokens.color.rule}`,background:tokens.color.paper0}}>
          <Composer/>
        </div>
      </div>
      <RightSidebar title="Room info" description="off-topic chatter" members={1} online={1} admins={['alice']}/>
    </AppChrome>
  );
}

function BrowseRoomsScreen(){
  const rooms = [
    {n:'general', m:128, d:'Everyone welcome. Announcements + small talk.', online:34},
    {n:'engineering', m:42, d:'backend + frontend discussions', online:12, priv:true},
    {n:'design', m:18, d:'Mockups, critique, type nerdery', online:5},
    {n:'random', m:56, d:'off-topic chatter', online:9},
    {n:'ops', m:7, d:'On-call and deploys', online:2, priv:true},
    {n:'lunch', m:22, d:'What are we eating today?', online:6},
  ];
  return (
    <AppChrome active="Public rooms" you="alice">
      <LeftSidebar/>
      <div style={{flex:1,overflow:'auto',background:tokens.color.paper1,padding:'20px 28px'}}>
        <Row style={{alignItems:'flex-end',justifyContent:'space-between',marginBottom:14}}>
          <Col gap={2}>
            <div style={{fontFamily:tokens.type.serif,fontSize:22,fontWeight:500}}>Browse rooms</div>
            <div style={{fontFamily:tokens.type.sans,fontSize:12,color:tokens.color.ink2}}>
              12 public · 4 private you're in
            </div>
          </Col>
          <Row gap={8}>
            <Input placeholder="Filter…" inputStyle={{fontSize:12,padding:'6px 8px',width:200}}/>
            <Button variant="primary">+ Create room</Button>
          </Row>
        </Row>
        <div style={{background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:3}}>
          {rooms.map((r,i)=>(
            <div key={r.n} style={{
              display:'flex',alignItems:'center',gap:14,padding:'10px 14px',
              borderBottom:i<rooms.length-1?`1px solid ${tokens.color.paper2}`:'none',
            }}>
              <div style={{fontFamily:tokens.type.mono,fontSize:13,width:140,color:tokens.color.ink0}}>
                <span style={{color:tokens.color.ink2,marginRight:4}}>{r.priv?'🔒':'#'}</span>{r.n}
              </div>
              <div style={{flex:1,fontSize:12,color:tokens.color.ink1}}>{r.d}</div>
              <div style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2,width:70,textAlign:'right'}}>{r.m} members</div>
              <div style={{fontFamily:tokens.type.mono,fontSize:11,width:80,textAlign:'right'}}>
                <Presence status="online" label={`${r.online} online`}/>
              </div>
              <Button size="sm">{r.priv?'Request':'Join'}</Button>
            </div>
          ))}
        </div>
      </div>
    </AppChrome>
  );
}

Object.assign(window, {MainChatScreen, DMScreen, BlockedDMScreen, EmptyRoomScreen, BrowseRoomsScreen});

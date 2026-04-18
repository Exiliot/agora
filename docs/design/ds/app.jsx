// app.jsx — assembles the agora design system canvas

const sampleColors = {bob:'#8a6f9e', alice:'#b38b59', carol:'#6b8e6b', you:'#5d7d8f', dave:'#a86a5c'};

function Logo({size=22}){
  // "agora" wordmark — serif ampersand-style mark + mono text, paper-era feel
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
      <div style={{
        width:size,height:size,background:tokens.color.ink0,color:tokens.color.paper0,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontFamily:tokens.type.serif,fontWeight:600,fontSize:Math.round(size*0.75),
        borderRadius:tokens.radius.xs,fontStyle:'italic',
      }}>a</div>
      <span style={{fontFamily:tokens.type.serif,fontSize:size*0.85,fontWeight:500,letterSpacing:.5,color:tokens.color.ink0}}>
        agora
      </span>
    </div>
  );
}

// ───────────────── Sections ─────────────────

function SecBrand(){
  return (
    <DCSection title="Brand" subtitle="A quiet wordmark. Agora = Greek gathering place. Serif for character; mono for substance.">
      <DCArtboard label="Wordmark" width={260} height={140}>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:18,height:'100%',justifyContent:'center'}}>
          <Logo size={36}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>agora.chat · classic rooms</div>
        </div>
      </DCArtboard>
      <DCArtboard label="On dark" width={260} height={140}>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:18,height:'100%',justifyContent:'center',background:tokens.color.ink0}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <div style={{width:36,height:36,background:tokens.color.paper0,color:tokens.color.ink0,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontFamily:tokens.type.serif,fontWeight:600,fontSize:27,borderRadius:2,fontStyle:'italic',
            }}>a</div>
            <span style={{fontFamily:tokens.type.serif,fontSize:31,color:tokens.color.paper0,fontWeight:500,letterSpacing:.5}}>agora</span>
          </div>
          <div style={{fontFamily:tokens.type.mono,fontSize:11,color:'#b8b4a7'}}>agora.chat · classic rooms</div>
        </div>
      </DCArtboard>
      <DCArtboard label="Voice" width={360} height={140}>
        <div style={{padding:20,fontFamily:tokens.type.sans,fontSize:13,color:tokens.color.ink1,lineHeight:1.55}}>
          <div style={{fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.4,textTransform:'uppercase',color:tokens.color.ink2,marginBottom:8}}>Tone</div>
          Direct. Lower-case. Terse.<br/>
          <span style={{color:tokens.color.ink2}}>“bob joined #engineering”</span> — not <span style={{textDecoration:'line-through',color:tokens.color.ink3}}>“🎉 Welcome Bob to the engineering channel!”</span>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecColor(){
  return (
    <DCSection title="Colors" subtitle="Warm paper + ink. A single muted teal accent. Flat swatches for status — no glow, no gradient.">
      <DCArtboard label="Paper / Ink" width={480} height={260}>
        <div style={{padding:20}}>
          <Meta style={{marginBottom:10}}>Neutrals</Meta>
          <Row gap={10} wrap>
            <Swatch name="paper-0" value="#fbf9f4"/>
            <Swatch name="paper-1" value="#f6f3ec" note="app bg"/>
            <Swatch name="paper-2" value="#ede9df" note="panel"/>
            <Swatch name="paper-3" value="#e2ddcf"/>
            <Swatch name="rule"    value="#d6d0be" note="1px"/>
          </Row>
          <div style={{height:12}}/>
          <Row gap={10} wrap>
            <Swatch name="ink-3" value="#9a988c" note="placeholder" textLight/>
            <Swatch name="ink-2" value="#6b6a60" note="meta" textLight/>
            <Swatch name="ink-1" value="#3a3a34" note="secondary" textLight/>
            <Swatch name="ink-0" value="#1a1a17" note="primary" textLight/>
          </Row>
        </div>
      </DCArtboard>
      <DCArtboard label="Accent" width={260} height={260}>
        <div style={{padding:20}}>
          <Meta style={{marginBottom:10}}>Oxidized teal · single accent</Meta>
          <Row gap={10} wrap>
            <Swatch name="accent-soft" value="oklch(0.92 0.03 190)" note="hover"/>
            <Swatch name="accent" value="oklch(0.52 0.07 190)" note="link" textLight/>
            <Swatch name="accent-ink" value="oklch(0.34 0.06 190)" note="pressed" textLight/>
          </Row>
          <div style={{height:12}}/>
          <div style={{fontSize:11,color:tokens.color.ink2,lineHeight:1.5,fontFamily:tokens.type.sans}}>
            One hue. All UI emphasis uses accent; status uses its own flat palette.
          </div>
        </div>
      </DCArtboard>
      <DCArtboard label="Status & signals" width={360} height={260}>
        <div style={{padding:20}}>
          <Meta style={{marginBottom:10}}>Presence</Meta>
          <Row gap={16}>
            <Presence status="online" label="online"/>
            <Presence status="afk" label="AFK (1min idle)"/>
            <Presence status="offline" label="offline"/>
          </Row>
          <div style={{height:14}}/>
          <Meta style={{marginBottom:10}}>Signal swatches</Meta>
          <Row gap={10} wrap>
            <Swatch name="online"  value="oklch(0.62 0.14 145)" textLight/>
            <Swatch name="afk"     value="oklch(0.72 0.12 75)"/>
            <Swatch name="danger"  value="oklch(0.52 0.16 27)" textLight/>
            <Swatch name="mention" value="oklch(0.93 0.05 85)" note="highlight"/>
          </Row>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecType(){
  return (
    <DCSection title="Type" subtitle="Inter for UI chrome, IBM Plex Mono for chat body + timestamps + IDs, Plex Serif reserved for the wordmark.">
      <DCArtboard label="Scale" width={520} height={420}>
        <div style={{padding:20}}>
          <div style={{fontFamily:tokens.type.serif,fontSize:34,letterSpacing:-0.3,color:tokens.color.ink0}}>Serif / Display · 34</div>
          <Meta>Plex Serif · wordmark, empty states, auth headings</Meta>
          <div style={{height:16}}/>
          <div style={{fontFamily:tokens.type.sans,fontSize:22,fontWeight:600,color:tokens.color.ink0}}>Sans Heading · 22/600</div>
          <Meta>Inter · modal titles, section headers</Meta>
          <div style={{height:10}}/>
          <div style={{fontFamily:tokens.type.sans,fontSize:14,fontWeight:500,color:tokens.color.ink0}}>Sans Label · 14/500</div>
          <Meta>Inter · form labels, nav items</Meta>
          <div style={{height:10}}/>
          <div style={{fontFamily:tokens.type.sans,fontSize:13,color:tokens.color.ink0,lineHeight:1.55,maxWidth:380}}>
            Sans body · 13/1.55 — used for UI prose, meta descriptions, and the scant marketing copy on login.
          </div>
          <div style={{height:14}}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:13,color:tokens.color.ink0,lineHeight:1.5}}>
            [10:21] bob: mono body · 13/1.5 &larr; the message row
          </div>
          <Meta>IBM Plex Mono · ALL chat content, timestamps, IDs</Meta>
          <div style={{height:10}}/>
          <div style={{fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2}}>META · 10/UPPER/.5</div>
          <Meta>Mono caps · section labels, timestamps, counts</Meta>
        </div>
      </DCArtboard>
      <DCArtboard label="Pairing in context" width={360} height={420}>
        <div style={{padding:0,height:'100%',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${tokens.color.rule}`,background:tokens.color.paper1}}>
            <div style={{fontFamily:tokens.type.sans,fontSize:14,fontWeight:600}}># engineering</div>
            <div style={{fontFamily:tokens.type.sans,fontSize:12,color:tokens.color.ink2}}>backend + frontend discussions</div>
          </div>
          <div style={{flex:1,padding:'6px 0',background:'#fff'}}>
            <MessageRow time="10:21" user="bob" color={sampleColors.bob}>Hello team 👋</MessageRow>
            <MessageRow time="10:22" user="alice" color={sampleColors.alice}>pushing spec in a sec</MessageRow>
            <MessageRow time="10:23" user="you" self color={sampleColors.you}>here's the file</MessageRow>
          </div>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecSpacing(){
  const scale = [2,4,6,8,12,16,24,32,48];
  return (
    <DCSection title="Spacing · Radius · Rule" subtitle="Tight, honest density. 4pt base. 1–2px radii. No drop-shadow clouds — hairlines do the work.">
      <DCArtboard label="Spacing scale (4pt)" width={460} height={220}>
        <div style={{padding:20}}>
          <Row gap={10} align="flex-end">
            {scale.map(s=>(
              <Col key={s} gap={6} style={{alignItems:'center'}}>
                <div style={{width:s,height:40,background:tokens.color.accent,borderRadius:1}}/>
                <Meta>{s}</Meta>
              </Col>
            ))}
          </Row>
          <div style={{height:14}}/>
          <div style={{fontSize:12,color:tokens.color.ink2,fontFamily:tokens.type.sans,lineHeight:1.5}}>
            Row padding: 3/12. Panel padding: 16. Dialog padding: 16. List row height: ~22px.
          </div>
        </div>
      </DCArtboard>
      <DCArtboard label="Radii & rules" width={360} height={220}>
        <div style={{padding:20}}>
          <Row gap={14} align="flex-end">
            {[{n:'xs',v:2},{n:'sm',v:3},{n:'md',v:4}].map(r=>(
              <Col key={r.n} gap={6} style={{alignItems:'center'}}>
                <div style={{width:52,height:52,background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:r.v}}/>
                <Meta>{r.n} · {r.v}px</Meta>
              </Col>
            ))}
          </Row>
          <div style={{height:16}}/>
          <Meta style={{marginBottom:6}}>Hairlines</Meta>
          <Col gap={8}>
            <div style={{height:1,background:tokens.color.rule}}/>
            <div style={{height:1,background:tokens.color.paper3}}/>
            <div style={{height:2,background:tokens.color.ink0}}/>
          </Col>
        </div>
      </DCArtboard>
      <DCArtboard label="Elevation" width={360} height={220}>
        <div style={{padding:20,display:'flex',gap:16,alignItems:'center',height:'100%'}}>
          <div style={{width:80,height:80,background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:2,boxShadow:'0 1px 0 rgba(0,0,0,.04)'}}/>
          <div style={{width:80,height:80,background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:3,boxShadow:'0 2px 6px rgba(0,0,0,.06)'}}/>
          <div style={{width:80,height:80,background:'#fff',border:`1px solid ${tokens.color.rule}`,borderRadius:3,boxShadow:'0 4px 16px rgba(0,0,0,.10)'}}/>
          <Col gap={32} style={{fontSize:10,fontFamily:tokens.type.mono,color:tokens.color.ink2}}>
            <div>flush · cards</div>
            <div>popovers</div>
            <div>dialogs</div>
          </Col>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecButtons(){
  return (
    <DCSection title="Buttons & inputs" subtitle="Beveled paper default; solid teal primary; link for inline prose. No pill radii, no bold shadows.">
      <DCArtboard label="Buttons" width={480} height={260}>
        <div style={{padding:20}}>
          <Meta style={{marginBottom:8}}>Variants</Meta>
          <Row gap={8} wrap>
            <Button>Default</Button>
            <Button variant="primary">Primary</Button>
            <Button variant="danger">Leave room</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Forgot password?</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <div style={{height:16}}/>
          <Meta style={{marginBottom:8}}>Sizes</Meta>
          <Row gap={8}>
            <Button size="sm" variant="primary">Send</Button>
            <Button size="md" variant="primary">Send message</Button>
            <Button size="lg" variant="primary">Create account</Button>
          </Row>
          <div style={{height:16}}/>
          <Meta style={{marginBottom:8}}>Button row (dialog)</Meta>
          <Row gap={8}>
            <Button>Cancel</Button>
            <Button variant="primary">Save changes</Button>
          </Row>
        </div>
      </DCArtboard>
      <DCArtboard label="Inputs" width={360} height={260}>
        <div style={{padding:20}}>
          <Col gap={12}>
            <Input label="Email" placeholder="you@example.com"/>
            <Input label="Password" type="password" value="••••••••"/>
            <Input label="Confirm password" value="••••••" error hint="Passwords don't match"/>
            <Row gap={14}>
              <Check label="Keep me signed in" checked/>
              <Check label="Remember device"/>
            </Row>
          </Col>
        </div>
      </DCArtboard>
      <DCArtboard label="Badges & chips" width={360} height={260}>
        <div style={{padding:20}}>
          <Col gap={10}>
            <Row gap={6} wrap>
              <Badge>owner</Badge>
              <Badge tone="accent">admin</Badge>
              <Badge tone="private">private</Badge>
              <Badge tone="mention">@you</Badge>
              <Badge tone="danger">banned</Badge>
            </Row>
            <Row gap={6} wrap>
              <Badge>38 members</Badge>
              <Badge>3 unread</Badge>
              <Badge tone="accent">new</Badge>
              <Badge>#general</Badge>
            </Row>
            <div style={{height:6}}/>
            <Meta>Avatars · deterministic initial only</Meta>
            <Row gap={6}>
              {['Alice','Bob','Carol','Dave','Eve','Frank'].map(n=><Avatar key={n} name={n} size={22}/>)}
            </Row>
          </Col>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecMessage(){
  return (
    <DCSection title="Messages" subtitle="Mono, [HH:MM] prefix, colored nickname, inline content. No bubbles. Replies quote-indent. Mentions get a left-rule + warm wash.">
      <DCArtboard label="Message row anatomy" width={540} height={260}>
        <div style={{padding:'10px 0'}}>
          <MessageRow time="10:21" user="bob" color={sampleColors.bob}>Hello team</MessageRow>
          <MessageRow time="10:22" user="alice" color={sampleColors.alice}>Uploading the spec now.</MessageRow>
          <MessageRow time="10:23" user="you" self color={sampleColors.you}>
            <FileCard name="spec-v3.pdf" size="284 KB" kind="pdf" comment="latest requirements"/>
          </MessageRow>
          <MessageRow time="10:25" user="carol" color={sampleColors.carol}
            reply={{user:'bob', color:sampleColors.bob, text:'Hello team'}}>
            Can we make this private?
          </MessageRow>
          <MessageRow time="10:26" user="dave" color={sampleColors.dave}>
            hey <span style={{background:tokens.color.mentionBg,color:tokens.color.mentionFg,padding:'0 3px',borderRadius:2}}>@you</span> — see the thread?
          </MessageRow>
          <MessageRow time="10:27" user="you" self mention color={sampleColors.you}>
            on it. also here's a screenshot:
            <div><FileCard img name="screen.png" size="1.2 MB"/></div>
          </MessageRow>
          <MessageRow time="10:31" user="bob" deleted color={sampleColors.bob}/>
          <MessageRow time="10:32" system>alice invited carol · carol joined the room</MessageRow>
        </div>
      </DCArtboard>
      <DCArtboard label="Composer" width={460} height={260}>
        <div style={{padding:16,background:tokens.color.paper1,height:'100%'}}>
          <Composer replyTo="bob"/>
          <div style={{height:14}}/>
          <Composer/>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecLists(){
  const rooms = [
    {name:'general', unread:3, active:true},
    {name:'engineering'},
    {name:'random'},
    {name:'muted-room', muted:true},
  ];
  const priv = [
    {name:'core-team', priv:true, unread:1},
    {name:'ops', priv:true},
  ];
  const contacts = [
    {name:'alice', status:'online'},
    {name:'bob',   status:'online'},
    {name:'carol', status:'afk', unread:2},
    {name:'dave',  status:'afk'},
    {name:'mike',  status:'offline'},
  ];
  return (
    <DCSection title="Lists" subtitle="Dense mono rows. Left-border-active. Unread as a small warm badge — never a red dot.">
      <DCArtboard label="Rooms sidebar" width={240} height={380}>
        <div style={{background:tokens.color.paper1,height:'100%',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 12px',borderBottom:`1px solid ${tokens.color.rule}`}}>
            <Input placeholder="Search…" inputStyle={{fontSize:12,padding:'6px 8px'}}/>
          </div>
          <div style={{padding:'8px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2}}>Public rooms</div>
          {rooms.map(r=><RoomListItem key={r.name} {...r}/>)}
          <div style={{padding:'10px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2}}>Private rooms</div>
          {priv.map(r=><RoomListItem key={r.name} {...r}/>)}
          <div style={{padding:'10px 12px 4px',fontFamily:tokens.type.mono,fontSize:10,letterSpacing:.5,textTransform:'uppercase',color:tokens.color.ink2}}>Contacts</div>
          {contacts.map(c=><ContactListItem key={c.name} {...c}/>)}
          <div style={{flex:1}}/>
          <div style={{padding:10,borderTop:`1px solid ${tokens.color.rule}`}}>
            <Button size="sm" style={{width:'100%'}}>+ Create room</Button>
          </div>
        </div>
      </DCArtboard>
      <DCArtboard label="Members / context panel" width={240} height={380}>
        <div style={{background:'#fff',height:'100%',padding:14,fontFamily:tokens.type.sans,fontSize:12}}>
          <div style={{fontSize:13,fontWeight:600}}># engineering-room</div>
          <Row gap={4} style={{marginTop:6}}>
            <Badge>public</Badge>
            <Badge>38 members</Badge>
          </Row>
          <div style={{height:12}}/>
          <Meta>Owner</Meta>
          <Row gap={4} style={{marginTop:4}}><Avatar name="Alice" size={18}/><span>alice</span></Row>
          <div style={{height:10}}/>
          <Meta>Admins</Meta>
          <Col gap={3} style={{marginTop:4,fontFamily:tokens.type.mono,fontSize:12}}>
            <span>alice</span><span>dave</span>
          </Col>
          <div style={{height:10}}/>
          <Meta>Members (38)</Meta>
          <Col gap={3} style={{marginTop:4}}>
            <Presence status="online" label="alice"/>
            <Presence status="online" label="bob"/>
            <Presence status="afk" label="carol"/>
            <Presence status="offline" label="mike"/>
          </Col>
          <div style={{height:12}}/>
          <Col gap={6}>
            <Button size="sm">Invite user</Button>
            <Button size="sm">Manage room</Button>
          </Col>
        </div>
      </DCArtboard>
      <DCArtboard label="Top navigation" width={760} height={60}>
        <div style={{display:'flex',alignItems:'center',height:'100%',background:tokens.color.paper1,borderBottom:`1px solid ${tokens.color.rule}`,paddingLeft:14,paddingRight:14}}>
          <Logo/>
          <div style={{width:24}}/>
          <NavTab active>Public rooms</NavTab>
          <NavTab>Private rooms</NavTab>
          <NavTab>Contacts</NavTab>
          <NavTab>Sessions</NavTab>
          <div style={{flex:1}}/>
          <NavTab>alice ▾</NavTab>
          <NavTab danger>Sign out</NavTab>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecModalsToasts(){
  return (
    <DCSection title="Dialogs, tabs, tables, toasts" subtitle="Chrome-bar titlebar. Underline tabs. Monospace table headers. Toasts as left-ruled notices.">
      <DCArtboard label="Manage room — Members tab" width={540} height={340}>
        <Modal title="Manage room · #engineering-room" width={540}>
          <TabBar items={['Members','Admins','Banned','Invitations','Settings']} active={0}/>
          <div style={{height:10}}/>
          <Input placeholder="Search member…" inputStyle={{fontSize:12}}/>
          <div style={{height:10}}/>
          <Table
            cols={['Username','Status','Role','Actions']}
            rows={[
              [<Row gap={6}><Avatar name="alice" size={18}/>alice</Row>, <Presence status="online" label="online"/>, <Badge tone="accent">owner</Badge>, <span style={{color:tokens.color.ink3,fontFamily:tokens.type.mono,fontSize:11}}>—</span>],
              [<Row gap={6}><Avatar name="dave" size={18}/>dave</Row>, <Presence status="afk" label="AFK"/>, <Badge>admin</Badge>, <Row gap={4}><Button size="sm">Remove admin</Button><Button size="sm" variant="danger">Ban</Button></Row>],
              [<Row gap={6}><Avatar name="bob" size={18}/>bob</Row>, <Presence status="online" label="online"/>, <span style={{fontFamily:tokens.type.mono,fontSize:11,color:tokens.color.ink2}}>member</span>, <Row gap={4}><Button size="sm">Make admin</Button><Button size="sm" variant="danger">Ban</Button></Row>],
            ]}
          />
        </Modal>
      </DCArtboard>
      <DCArtboard label="Auth · sign in" width={360} height={340}>
        <Modal title="Sign in" width={360}>
          <Col gap={12}>
            <Input label="Email" placeholder="you@example.com"/>
            <Input label="Password" type="password" placeholder="••••••••"/>
            <Check label="Keep me signed in" checked/>
            <Row gap={8} style={{justifyContent:'space-between',alignItems:'center'}}>
              <Button variant="link" style={{padding:0}}>Forgot password?</Button>
              <Button variant="primary">Sign in</Button>
            </Row>
          </Col>
        </Modal>
      </DCArtboard>
      <DCArtboard label="System notices" width={360} height={340}>
        <div style={{padding:16,background:tokens.color.paper1,height:'100%'}}>
          <Col gap={10}>
            <Toast tone="info" title="New session detected">Signed in from Safari · macOS. <Button variant="link" style={{padding:0}}>Review sessions</Button></Toast>
            <Toast tone="success">Room settings saved.</Toast>
            <Toast tone="warn" title="Reconnecting…">WebSocket dropped — retrying in 2s.</Toast>
            <Toast tone="error" title="File too large">Images are capped at 3&nbsp;MB. Files at 20&nbsp;MB.</Toast>
          </Col>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

function SecPrinciples(){
  const items = [
    ['Text first', 'A chat is a river of text. Type leads, chrome follows.'],
    ['Density honestly', 'Power users re-read history. 3px row padding, not 14px.'],
    ['No bubbles', '[HH:MM] nick: message — the invariant the last 40 years chose.'],
    ['One accent, one hue', 'Status has its own tiny palette. Everything else is teal or ink.'],
    ['Hairlines > shadows', '1px rules do the layout work. Shadows only for floating surfaces.'],
    ['Mono for truth', 'Timestamps, IDs, file sizes, counts — all mono. Never lie with proportional digits.'],
  ];
  return (
    <DCSection title="Principles" subtitle="The rules underneath every choice above.">
      <DCArtboard label="" width={820} height={220}>
        <div style={{padding:20,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,height:'100%'}}>
          {items.map(([t,d])=>(
            <Col key={t} gap={4}>
              <div style={{fontFamily:tokens.type.sans,fontSize:13,fontWeight:600,color:tokens.color.ink0}}>{t}</div>
              <div style={{fontFamily:tokens.type.sans,fontSize:12,color:tokens.color.ink2,lineHeight:1.5}}>{d}</div>
            </Col>
          ))}
        </div>
      </DCArtboard>
    </DCSection>
  );
}

// ───────────────── Root ─────────────────
function App(){
  return (
    <DesignCanvas>
      <div style={{padding:'20px 60px 30px',maxWidth:1200}}>
        <Logo size={46}/>
        <div style={{fontFamily:tokens.type.sans,fontSize:14,color:tokens.color.ink2,marginTop:12,maxWidth:640,lineHeight:1.55}}>
          A design system for <b style={{color:tokens.color.ink0}}>agora</b> — a classic web chat (IRC-lineage, rocket.chat-era): rooms, DMs, presence, file sharing, moderation. Not a modern social network. Not a messenger with reactions and stories.
        </div>
        <Row gap={8} style={{marginTop:14}} wrap>
          <Badge>Inter · IBM Plex Mono · IBM Plex Serif</Badge>
          <Badge tone="accent">oklch(0.52 0.07 190)</Badge>
          <Badge>4pt spacing</Badge>
          <Badge>2–4px radius</Badge>
          <Badge>hairlines over shadows</Badge>
        </Row>
      </div>
      <SecPrinciples/>
      <SecBrand/>
      <SecColor/>
      <SecType/>
      <SecSpacing/>
      <SecButtons/>
      <SecMessage/>
      <SecLists/>
      <SecModalsToasts/>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

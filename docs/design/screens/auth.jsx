// auth.jsx — sign in, register, forgot password, reset password

function SignInScreen(){
  return (
    <AuthChrome>
      <div style={{width:360}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontFamily:tokens.type.serif,fontSize:26,fontWeight:500,color:tokens.color.ink0}}>Welcome back</div>
          <div style={{fontFamily:tokens.type.sans,fontSize:13,color:tokens.color.ink2,marginTop:4}}>
            Sign in to join the conversation.
          </div>
        </div>
        <Modal title="Sign in" width={360}>
          <Col gap={12}>
            <Input label="Email" placeholder="you@example.com"/>
            <Input label="Password" type="password" placeholder="••••••••"/>
            <Row gap={8} style={{justifyContent:'space-between'}}>
              <Check label="Keep me signed in" checked/>
              <Button variant="link" style={{padding:0,fontSize:12}}>Forgot password?</Button>
            </Row>
            <div style={{height:2}}/>
            <Button variant="primary" style={{width:'100%'}}>Sign in</Button>
            <div style={{textAlign:'center',fontSize:12,color:tokens.color.ink2}}>
              No account? <Button variant="link" style={{padding:0,fontSize:12}}>Register</Button>
            </div>
          </Col>
        </Modal>
      </div>
    </AuthChrome>
  );
}

function RegisterScreen(){
  return (
    <AuthChrome>
      <div style={{width:380}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontFamily:tokens.type.serif,fontSize:26,fontWeight:500}}>Create account</div>
          <div style={{fontFamily:tokens.type.sans,fontSize:13,color:tokens.color.ink2,marginTop:4}}>
            Pick a username. It's visible in every room you join.
          </div>
        </div>
        <Modal title="Register" width={380}>
          <Col gap={12}>
            <Input label="Email" placeholder="you@example.com"/>
            <Input label="Username" value="alice" hint="3–24 chars · letters, numbers, _ and -"/>
            <Input label="Password" type="password" placeholder="••••••••"/>
            <Input label="Confirm password" type="password" value="••••••" error hint="Passwords don't match"/>
            <div style={{fontSize:11,color:tokens.color.ink2,lineHeight:1.5}}>
              By continuing you agree to the <Button variant="link" style={{padding:0,fontSize:11}}>terms</Button> and acknowledge the <Button variant="link" style={{padding:0,fontSize:11}}>privacy note</Button>.
            </div>
            <Button variant="primary" style={{width:'100%'}}>Create account</Button>
            <div style={{textAlign:'center',fontSize:12,color:tokens.color.ink2}}>
              Have an account? <Button variant="link" style={{padding:0,fontSize:12}}>Sign in</Button>
            </div>
          </Col>
        </Modal>
      </div>
    </AuthChrome>
  );
}

function ForgotScreen(){
  return (
    <AuthChrome>
      <div style={{width:400}}>
        <Modal title="Forgot password" width={400}>
          <Col gap={12}>
            <div style={{fontSize:13,color:tokens.color.ink1,lineHeight:1.5}}>
              Enter the email on your account. If it exists, we'll send a reset link valid for 30 minutes.
            </div>
            <Input label="Email" placeholder="you@example.com"/>
            <Row gap={8} style={{justifyContent:'flex-end'}}>
              <Button>Cancel</Button>
              <Button variant="primary">Send reset link</Button>
            </Row>
          </Col>
        </Modal>
        <div style={{height:12}}/>
        <Toast tone="info" title="Check your inbox">
          If <b>you@example.com</b> has an account, a reset link is on its way.
        </Toast>
      </div>
    </AuthChrome>
  );
}

function ResetScreen(){
  return (
    <AuthChrome>
      <div style={{width:380}}>
        <Modal title="Reset password" width={380}>
          <Col gap={12}>
            <div style={{fontSize:13,color:tokens.color.ink1}}>Signed in as <b>alice@example.com</b></div>
            <Input label="New password" type="password" placeholder="••••••••" hint="Min 10 characters"/>
            <Input label="Confirm new password" type="password" placeholder="••••••••"/>
            <Toast tone="warn">
              Resetting will sign out <b>all 3 sessions</b>.
            </Toast>
            <Row gap={8} style={{justifyContent:'flex-end'}}>
              <Button>Cancel</Button>
              <Button variant="primary">Reset password</Button>
            </Row>
          </Col>
        </Modal>
      </div>
    </AuthChrome>
  );
}

Object.assign(window, {SignInScreen, RegisterScreen, ForgotScreen, ResetScreen});

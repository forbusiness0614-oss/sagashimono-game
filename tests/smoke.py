"""Browser integration tests. Run with Python Playwright and system Chromium.
The independently measured points below are inside the visible objects.
"""
from playwright.sync_api import sync_playwright
POINTS={'duck':(301,452),'ball':(960,302),'apple':(983,455),'glass':(860,808),'cube':(618,438),'clock':(1259,441),'pine':(438,618),'star':(987,617),'plane':(525,125),'dino':(459,289)}
URL='http://127.0.0.1:8002/'

def tap(page,key,zoom=1):
    x,y=POINTS[key]
    page.evaluate('''([x,y,z])=>{const v=document.querySelector('#viewport');scale=z;pan={x:v.clientWidth/2-x/1536*v.clientWidth*z,y:v.clientHeight/2-y/1024*v.clientHeight*z};renderTransform()}''',[x,y,zoom])
    rect=page.locator('#room').bounding_box()
    page.mouse.click(rect['x']+x/1536*rect['width'],rect['y']+y/1024*rect['height'])

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    checks=0
    for width,height in [(390,844),(820,1180),(1440,1100)]:
        page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL)
        page.locator('#room').wait_for()
        page.wait_for_function('document.querySelector("#room").naturalWidth===1536')
        assert page.locator('#welcome').is_visible()
        page.wait_for_timeout(1100)
        assert page.locator('#time').inner_text()=='00:00'
        page.locator('#begin').click()
        page.wait_for_function('document.querySelector("#time").textContent!=="00:00"',timeout=3500)
        assert page.evaluate('elapsed()>=1000')
        page.locator('#restart').click()
        assert page.locator('.item').count()==10
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # Empty wall cannot score.
        r=page.locator('#room').bounding_box()
        page.mouse.click(r['x']+r['width']*.4,r['y']+r['height']*.92)
        assert page.locator('#foundCount').inner_text()=='0'
        for z in [1,2,4]:
            page.locator('#restart').click()
            for key in POINTS:
                tap(page,key,z)
                assert page.locator(f'#item-{key}').get_attribute('class')=='item done', (width,z,key)
                checks+=1
            assert page.locator('#complete').is_visible()
            assert page.locator('#foundCount').inner_text()=='10'
            assert page.locator('.found-marker').count()==10
            assert page.locator('#resultTime').inner_text()!=''
            frozen=page.locator('#time').inner_text()
            page.wait_for_timeout(1100)
            assert page.locator('#time').inner_text()==frozen
            page.locator('#playAgain').click()
            assert page.locator('.done').count()==0
            assert page.locator('#hintsLeft').inner_text()=='3'
        # Each target can be hinted; reset to restore three hints, find preceding targets.
        for index,key in enumerate(POINTS):
            page.locator('#restart').click()
            for preceding in list(POINTS)[:index]:tap(page,preceding,2)
            page.locator('#hint').click()
            assert page.locator('.hinted').get_attribute('data-target')==key
            b=page.locator('.hinted').bounding_box();v=page.locator('#viewport').bounding_box()
            assert b['x']+b['width']>v['x'] and b['x']<v['x']+v['width']
            tap(page,key,2)
            assert page.locator('.hinted').count()==0
            checks+=1
            if page.locator('#complete').is_visible():page.locator('#closeResult').click()
        page.locator('#restart').click()
        for _ in range(3):page.locator('#hint').click()
        assert page.locator('#hint').is_disabled()
        assert page.locator('#hintsLeft').inner_text()=='0'
        page.locator('#restart').click()
        page.locator('#zoomIn').click();assert page.locator('#zoomReset').inner_text()=='150%'
        page.locator('#zoomOut').click();assert page.locator('#zoomReset').inner_text()=='100%'
        page.locator('#viewport').hover();page.mouse.wheel(0,-400)
        assert page.locator('#zoomReset').inner_text()!='100%'
        page.locator('#zoomReset').click();assert page.locator('#zoomReset').inner_text()=='100%'
        assert not errors,errors
        if width==1440:page.screenshot(path='/workspace/sagashimono-game/tests/desktop.png',full_page=True)
        page.close()
    # Actual mobile touch: pinch, drag without a false score, then hit a target.
    page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    page.goto(URL);page.wait_for_function('document.querySelector("#room").naturalWidth===1536')
    page.locator('#begin').click()
    session=page.context.new_cdp_session(page)
    box=page.locator('#viewport').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
    def touch(kind,pts):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]})
    touch('touchStart',[(cx-35,cy),(cx+35,cy)])
    touch('touchMove',[(cx-75,cy),(cx+75,cy)])
    touch('touchEnd',[])
    assert page.evaluate('scale>1.8')
    old=page.evaluate('pan.x')
    touch('touchStart',[(cx,cy)]);touch('touchMove',[(cx-35,cy-20)]);touch('touchEnd',[])
    assert page.evaluate('pan.x')!=old
    assert page.locator('#foundCount').inner_text()=='0'
    page.locator('#zoomReset').click()
    page.locator('#viewport').scroll_into_view_if_needed()
    r=page.locator('#room').bounding_box();x,y=POINTS['duck']
    page.touchscreen.tap(r['x']+r['width']*x/1536,r['y']+r['height']*y/1024)
    page.wait_for_function('document.querySelector("#foundCount").textContent==="1"')
    page.set_viewport_size({'width':820,'height':1180})
    page.wait_for_timeout(200)
    assert page.locator('#foundCount').inner_text()=='1'
    tap(page,'ball',2)
    page.wait_for_function('document.querySelector("#foundCount").textContent==="2"')
    browser.close()
    print(f'PASS: {checks} target/zoom/hint checks, 3 screen sizes, clear/restart, hint limit, timer, wheel, pinch, drag, touch, no JS errors')

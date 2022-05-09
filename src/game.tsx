import { ticks, sand, red, blue, dark } from './shared'
import { AppProvider, useApp } from './app'
import { Quad, Vec2 } from 'soli2d-js/web'
import { onCleanup, onMount, Show, For, on, createEffect, createContext, useContext, createSignal } from 'soli2d-js'

import { read, owrite, write } from './play'
import GGame from './ggame.ts'

const Game = (props) => {
  return (<>
   <Background/> 
   
   <Player player={props.game.player}/>
   <Cursor cursor={props.game.cursor}/>
   
    <For each={props.game.enemies}>{ enemy =>
      <HasPosition x={enemy.pos.x} y={enemy.pos.y}>
        <Rectangle lum={1} color={enemy.tint} w={8} h={8}/>
      </HasPosition>    
    }</For>

    <Rectangle color={red} w={30} h={9}/>
    <HasPosition x={1} y={1}>
      <Letters letters={props.game.level.m_level()}/>
    </HasPosition>

    <For each={props.game.player.waypoints}>{ waypoint =>
      <HasPosition x={waypoint.pos.x} y={waypoint.pos.y}>
        <Rectangle lum={0} color={dark} w={2} h={2}/>
      </HasPosition>    
    }</For>

    <For each={props.game.projectiles}>{ projectile =>
      <HasPosition x={projectile.pos.x} y={projectile.pos.y}>
        <Rectangle lum={2} color={sand} w={2} h={2}/>
      </HasPosition>    
    }</For>
   </>)
}
const Waypoint = props => {
  return (<HasPosition x={props.waypoint.pos.x} y={props.waypoint.pos.y}>
      <Rectangle lum={0} w={2} h={2}/> 
   </HasPosition>)
}

const Cursor = props => {
  return (<HasPosition x={props.cursor.pos.x} y={props.cursor.pos.y}>
   <Rectangle lum={0} x={-2} y={-2} w={2} h={2}/>
   <Rectangle lum={0} w={4} h={6}/>
      </HasPosition>)
}

const Player = (props) => {
  return (<HasPosition x={props.player.pos.x} y={props.player.pos.y}>
      <Rectangle color={blue} w={10} h={10}/>
    </HasPosition>)
}

const Background = () => {
  return (<Rectangle x={0} y={0} w={320} h={180}/>)
}

const Letters = props => {
  return (<>
    <For each={props.letters}>{(letter, i) =>
      <HasPosition x={i()*4} y={0}>
        <Anim tint={letter.tint} qs={[16 + letter.frame * 8, 16, 8, 7]}/>
      </HasPosition>
    }</For>
      </>)
}



const Rectangle = (props) => {
  return (<Anim qs={[0 + (props.lum ?? 2) * 2, 0 + (props.color ?? 0) * 2, 1, 1]} size={Vec2.make(props.w, props.h)} x={props.x} y={props.y}/>)
}


const HasPosition = props => {
  return (<transform tint={props.tint} x={props.x} y={props.y}>
      {props.children}
      </transform>)
}


export const Anim = (props) => {

  let [{image}] = useApp()

  return (<transform
          quad={Quad.make(image(), ...props.qs)}
          size={props.size || Vec2.make(props.qs[2], props.qs[3])}
          tint={props.tint}
          x={props.x}
          y={props.y}
          />)
}

export const DropTarget = (props) => {

  const [{mouse}] = useApp()

  let t_ref

  onMount(() => {
    props.set_ref?.(t_ref)
    t_ref.on_event = () => {
      let { drag, click, click_down } = mouse()

      if (props.onDrag && drag && !drag.move0 && !drag.drop) {
        let hit = vec_transform_inverse_matrix(Vec2.make(...drag.start), t_ref)

        if (Math.floor(hit.x) === 0 && Math.floor(hit.y) === 0) {
            let decay = DragDecay.make(drag, t_ref)
            return props.onDrag(decay)
        }
      }
      if (props.onClick && click) {
        let hit = vec_transform_inverse_matrix(Vec2.make(...click), t_ref)
        if (Math.floor(hit.x) === 0 && Math.floor(hit.y) === 0) {
          return props.onClick()
        }
      }

      if (props.onClickDown && click_down) {
        let hit = vec_transform_inverse_matrix(Vec2.make(...click_down), t_ref)
        if (Math.floor(hit.x) === 0 && Math.floor(hit.y) === 0) {
          return props.onClickDown()
        } 
      }
    }
  })

  return (<transform
          ref={t_ref}
          size={Vec2.make(props.qs[2], props.qs[3])}
          x={props.x}
          y={props.y}
          />)
}


const TweenPosition = (props) => {

  let ix = props.ix === undefined ? props.x : props.ix
  let iy = props.iy === undefined ? props.y : props.iy

  let tX = createSignal(new TweenVal(ix, ix, props.duration || ticks.half, TweenVal.quad_in_out), { equals: false })
  let tY = createSignal(new TweenVal(iy, iy, props.duration || ticks.half, TweenVal.quad_in_out), { equals: false })

  let [{update}] = useApp()

  createEffect(on(update, ([dt, dt0]) => {
    write(tX, _ => _.update(dt, dt0))
    write(tY, _ => _.update(dt, dt0))
    }))

  createEffect(() => {
      owrite(tX, _ => _.new_b(props.x))
      })

  createEffect(() => {
    owrite(tY, _ => _.new_b(props.y))
    })
  
  return (<transform x={read(tX).value} y={read(tY).value}>
      {props.children}
      </transform>)

}



const App = (_render, _image, _root, $canvas) => {

  let _App = () => {

    const [{image, root, update, render, mouse}, { _setImage, _setRoot }] = useApp()

      _setImage(_image)
      _setRoot(_root)

      createEffect(on(render, () => {
         root()._update_world()
         _render()
      }))

    let game = new GGame()

    return (<Game game={game}/>)
  }

  return () => (<AppProvider $canvas={$canvas}> <_App/> </AppProvider>)
}

export default App

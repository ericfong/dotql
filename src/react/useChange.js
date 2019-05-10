import { useRef, useState, useCallback } from 'react'
import shallowEqual from 'shallow-equal/objects'

const useChange = initState => {
  const [, setState] = useState(initState)
  const ref = useRef(initState)

  return [
    ref.current,
    useCallback(newState => {
      if (!shallowEqual(ref.current, newState)) {
        ref.current = newState
        setState(newState)
      }
    }, []),
  ]
}

export default useChange

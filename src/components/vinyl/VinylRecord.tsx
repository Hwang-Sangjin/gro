'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createGrooveMaterial,
  defaultGrooveParams,
  type GrooveParams,
} from './grooveMaterial'

type VinylRecordProps = Partial<GrooveParams> & {
  /** 33.333 | 45 | 0 */
  rpm?: number
  /** 0–1, 방사형 빛줄기 강도 */
  anisotropy?: number
  url?: string
} & ThreeElements['group']

export function VinylRecord({
  rpm = 0,
  anisotropy = 0.85,
  url = '/models/vinyl.glb',
  grooveFreq = defaultGrooveParams.grooveFreq,
  grooveDepth = defaultGrooveParams.grooveDepth,
  trackCount = defaultGrooveParams.trackCount,
  gapWidth = defaultGrooveParams.gapWidth,
  innerR = defaultGrooveParams.innerR,
  outerR = defaultGrooveParams.outerR,
  gapRoughness = defaultGrooveParams.gapRoughness,
  ...groupProps
}: VinylRecordProps) {
  // drei의 useGLTF는 Draco를 자동 처리 → Blender export한 압축 glb 그대로 사용 가능
  const { scene } = useGLTF(url, '/draco/')
  const invalidate = useThree(state => state.invalidate)
  const discRef = useRef<THREE.Group>(null)

  const { material, uniforms } = useMemo(() => createGrooveMaterial(), [])

  // Clone shared geometry and replace only the groove material.
  const model = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const replace = (original: THREE.Material) => {
        if (original.name === 'Material.002') return material
        return original
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replace) : replace(mesh.material)
    })
    return cloned
  }, [scene, material])

  // props → uniforms (리컴파일 없음)
  useEffect(() => {
    uniforms.uGrooveFreq.value = grooveFreq
    uniforms.uGrooveDepth.value = grooveDepth
    uniforms.uTrackCount.value = trackCount
    uniforms.uGapWidth.value = gapWidth
    uniforms.uInnerR.value = innerR
    uniforms.uOuterR.value = outerR
    uniforms.uGapRoughness.value = gapRoughness
    material.anisotropy = Math.max(anisotropy, 0.001)
    invalidate()
  }, [invalidate, uniforms, material, grooveFreq, grooveDepth, trackCount, gapWidth, innerR, outerR, gapRoughness, anisotropy])

  useEffect(() => () => {
    material.dispose()
  }, [material])

  useFrame((_, delta) => {
    if (!discRef.current || rpm === 0) return
    discRef.current.rotation.y -= (rpm / 60) * Math.PI * 2 * delta
  })

  return (
    <group {...groupProps}>
      <group ref={discRef}>
        <primitive object={model} dispose={null} />
      </group>
    </group>
  )
}

// The Hero is dynamically imported; no server-side GLB preload is required.

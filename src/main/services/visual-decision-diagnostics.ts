import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { requireAssetProjectRoot } from '../assets/openmoji/publish'
import { resolveProjectRelativePath, writeJsonAtomic } from './project-persistence'

export const VISUAL_DECISION_DIAGNOSTIC_VERSION = 1 as const

export type PersistedVisualDecisionDiagnosticV1 = {
  diagnosticVersion: typeof VISUAL_DECISION_DIAGNOSTIC_VERSION
  generationId: string
  createdAt: string
  summary: {
    requestedVisuals: number
    materializedVisuals: number
    qcRejectedVisuals: number
    resolverDegradedVisuals: number
    substitutedWithOriginal: number
    reasons: Record<string, number>
  }
  scenes: unknown[]
}

export class VisualDecisionDiagnosticError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'VisualDecisionDiagnosticError'
  }
}

function fail(code: string, message: string): never {
  throw new VisualDecisionDiagnosticError(code, message)
}

function validGenerationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(value))
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'generationId diagnóstico inválido')
  return value
}

function validateDiagnostic(raw: unknown): PersistedVisualDecisionDiagnosticV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'Diagnóstico visual inválido')
  const value = raw as Record<string, unknown>
  const allowed = ['diagnosticVersion', 'generationId', 'createdAt', 'summary', 'scenes']
  if (!Object.keys(value).every(key => allowed.includes(key)))
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'Diagnóstico contiene campos no permitidos')
  if (value.diagnosticVersion !== VISUAL_DECISION_DIAGNOSTIC_VERSION)
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'Versión de diagnóstico visual inválida')
  validGenerationId(value.generationId)
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt)))
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'createdAt de diagnóstico visual inválido')
  if (!value.summary || typeof value.summary !== 'object' || Array.isArray(value.summary))
    fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'summary de diagnóstico visual inválido')
  if (!Array.isArray(value.scenes)) fail('VISUAL_DECISION_DIAGNOSTIC_INVALID', 'scenes de diagnóstico visual inválido')
  return raw as PersistedVisualDecisionDiagnosticV1
}

/** A project-local diagnostic artifact, deliberately outside project-state and PixelIdentity. */
export function writeVisualDecisionDiagnostic(
  projectRoot: unknown,
  diagnostic: PersistedVisualDecisionDiagnosticV1,
): { absoluteFile: string; relativeFile: string; sha256: string } {
  const root = requireAssetProjectRoot(projectRoot)
  const value = validateDiagnostic(diagnostic)
  const relativeFile = 'materiales/diagnostics/visual-decisions/' + validGenerationId(value.generationId) + '.json'
  const absoluteFile = resolveProjectRelativePath(root, relativeFile)
  fs.mkdirSync(path.dirname(absoluteFile), { recursive: true })
  writeJsonAtomic(absoluteFile, value, validateDiagnostic, 'VISUAL_DECISION_DIAGNOSTIC')
  const bytes = fs.readFileSync(absoluteFile)
  return {
    absoluteFile,
    relativeFile,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

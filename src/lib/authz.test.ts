import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationInvites,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  atLeast,
  canComment,
  canEdit,
  canManageShares,
  getDocumentAccess,
  getTrashedDocumentAccess,
  isPublicTokenShaped,
  lookupPublicDocument,
  registerInviteAttempt,
  registerPublicLookupAttempt,
  resetInviteLimiter,
  resetPublicLookupLimiter,
} from '@/lib/authz'
import {
  acceptPendingInvites,
  canManageOrganization,
  detachMemberDocuments,
  getMembership,
  listOrganizationDocuments,
  listOrganizationEmails,
  otherOwnersInOrganization,
} from '@/lib/organizations'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }
const editor = { id: 'user-editor', email: 'editor@arvore.com.br' }
const viewer = { id: 'user-viewer', email: 'reader@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'outside@arvore.com.br' }
const orgAdmin = { id: 'user-org-admin', email: 'admin@arvore.com.br' }
const orgMember = { id: 'user-org-member', email: 'member@arvore.com.br' }
const outsider = { id: 'user-outsider', email: 'external@otherschool.com.br' }

const liveToken = 'kQ4nPz7bLxRfT2aWmC9uVhJ8'
const trashedToken = 'Zt6yBn3kQwEr8sDf1gHj5LpM'

function sessionFor(person: { id: string; email: string }) {
  return { user: person }
}

const mainOrg = 'org-arvore'
const otherOrg = 'org-other-school'

beforeEach(async () => {
  await resetDatabase()
  resetPublicLookupLimiter()
  resetInviteLimiter()

  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(organizationInvites)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [owner, editor, viewer, stranger, orgAdmin, orgMember, outsider].map(
      (person) => ({
        id: person.id,
        name: person.email,
        email: person.email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  )

  await db.insert(organizations).values([
    { id: mainOrg, name: 'Árvore School', createdAt: now },
    { id: otherOrg, name: 'Other School', createdAt: now },
  ])

  await db.insert(organizationMembers).values([
    {
      id: 'member-owner',
      orgId: mainOrg,
      userId: owner.id,
      role: 'owner',
      createdAt: now,
    },
    {
      id: 'member-admin',
      orgId: mainOrg,
      userId: orgAdmin.id,
      role: 'admin',
      createdAt: now,
    },
    {
      id: 'member-member',
      orgId: mainOrg,
      userId: orgMember.id,
      role: 'member',
      createdAt: now,
    },
    {
      id: 'member-outsider',
      orgId: otherOrg,
      userId: outsider.id,
      role: 'owner',
      createdAt: now,
    },
  ])

  await db.insert(documents).values([
    {
      id: 'doc-live',
      ownerId: owner.id,
      title: 'Live document',
      content: null,
      publicToken: liveToken,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'doc-private',
      ownerId: owner.id,
      title: 'Private document',
      content: null,
      publicToken: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'doc-trashed',
      ownerId: owner.id,
      title: 'Trashed document',
      content: null,
      publicToken: trashedToken,
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
    {
      id: 'doc-org-private',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: null,
      title: 'Member draft',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-viewer',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'viewer',
      title: 'Lesson plan',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-editor',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'editor',
      title: 'Meeting minutes',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-trashed',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'editor',
      title: 'Old minutes',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
    {
      id: 'doc-other-org',
      ownerId: outsider.id,
      orgId: otherOrg,
      orgAccess: 'editor',
      title: 'Document of the other school',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-commenter',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'commenter',
      title: 'Proposal under review',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-commenter',
      ownerId: owner.id,
      title: 'Document with a reviewer',
      createdAt: now,
      updatedAt: now,
    },
  ])

  await db.insert(documentShares).values([
    {
      id: 'share-editor',
      documentId: 'doc-live',
      granteeEmail: editor.email,
      role: 'editor',
      createdAt: now,
    },
    {
      id: 'share-viewer',
      documentId: 'doc-live',
      granteeEmail: viewer.email,
      role: 'viewer',
      createdAt: now,
    },
    {
      id: 'share-org-downgrade',
      documentId: 'doc-org-editor',
      granteeEmail: orgAdmin.email,
      role: 'viewer',
      createdAt: now,
    },
    {
      id: 'share-guest',
      documentId: 'doc-org-private',
      granteeEmail: outsider.email,
      role: 'viewer',
      createdAt: now,
    },
    {
      id: 'share-commenter',
      documentId: 'doc-commenter',
      granteeEmail: viewer.email,
      role: 'commenter',
      createdAt: now,
    },
    {
      id: 'share-org-commenter',
      documentId: 'doc-org-commenter',
      granteeEmail: orgAdmin.email,
      role: 'editor',
      createdAt: now,
    },
  ])
})

describe('getDocumentAccess', () => {
  it('recognizes the owner', async () => {
    await expect(getDocumentAccess('doc-live', sessionFor(owner))).resolves.toBe(
      'owner',
    )
  })

  it('recognizes an invited editor', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(editor)),
    ).resolves.toBe('editor')
  })

  it('recognizes an invited viewer', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(viewer)),
    ).resolves.toBe('viewer')
  })

  it('resolves the invite ignoring the email case', async () => {
    await expect(
      getDocumentAccess('doc-live', {
        user: { id: editor.id, email: editor.email.toUpperCase() },
      }),
    ).resolves.toBe('editor')
  })

  it('recognizes an invited person with the commenter role', async () => {
    await expect(
      getDocumentAccess('doc-commenter', sessionFor(viewer)),
    ).resolves.toBe('commenter')
    await expect(
      getDocumentAccess('doc-commenter', sessionFor(editor)),
    ).resolves.toBeNull()
  })

  it('denies whoever was not invited', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(stranger)),
    ).resolves.toBeNull()
  })

  it('denies a visitor without a session', async () => {
    await expect(getDocumentAccess('doc-live', null)).resolves.toBeNull()
  })

  it('denies a trashed document even to the owner', async () => {
    await expect(
      getDocumentAccess('doc-trashed', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('denies a document that does not exist', async () => {
    await expect(
      getDocumentAccess('doc-missing', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('does not leak access from one document to another', async () => {
    await expect(
      getDocumentAccess('doc-private', sessionFor(editor)),
    ).resolves.toBeNull()
  })
})

describe('getTrashedDocumentAccess', () => {
  it('allows the owner', async () => {
    await expect(
      getTrashedDocumentAccess('doc-trashed', sessionFor(owner)),
    ).resolves.toBe('owner')
  })

  it('denies an invited person', async () => {
    await expect(
      getTrashedDocumentAccess('doc-trashed', sessionFor(editor)),
    ).resolves.toBeNull()
  })
})

describe('role hierarchy', () => {
  it('canEdit holds for owner and editor', () => {
    expect(canEdit('owner')).toBe(true)
    expect(canEdit('editor')).toBe(true)
    expect(canEdit('commenter')).toBe(false)
    expect(canEdit('viewer')).toBe(false)
    expect(canEdit(null)).toBe(false)
  })

  it('canComment holds from commenter upwards', () => {
    expect(canComment('owner')).toBe(true)
    expect(canComment('editor')).toBe(true)
    expect(canComment('commenter')).toBe(true)
    expect(canComment('viewer')).toBe(false)
    expect(canComment(null)).toBe(false)
  })

  it('the precedence is viewer < commenter < editor < owner', () => {
    expect(atLeast('commenter', 'viewer')).toBe(true)
    expect(atLeast('viewer', 'commenter')).toBe(false)
    expect(atLeast('editor', 'commenter')).toBe(true)
    expect(atLeast('commenter', 'editor')).toBe(false)
    expect(atLeast('owner', 'editor')).toBe(true)
    expect(atLeast('commenter', 'commenter')).toBe(true)
  })

  it('canManageShares holds only for the owner', () => {
    expect(canManageShares('owner')).toBe(true)
    expect(canManageShares('editor')).toBe(false)
    expect(canManageShares('viewer')).toBe(false)
    expect(canManageShares(null)).toBe(false)
  })
})

describe('public link', () => {
  it('accepts a valid token', async () => {
    const result = await lookupPublicDocument(liveToken, 'ip-1')

    expect(result.status).toBe('ok')
    expect(result.status === 'ok' && result.document.id).toBe('doc-live')
  })

  it('rejects the token of a trashed document', async () => {
    const result = await lookupPublicDocument(trashedToken, 'ip-1')

    expect(result.status).toBe('not-found')
  })

  it('rejects a revoked token', async () => {
    await db
      .update(documents)
      .set({ publicToken: null })
      .where(eq(documents.id, 'doc-live'))

    const result = await lookupPublicDocument(liveToken, 'ip-1')

    expect(result.status).toBe('not-found')
  })

  it('rejects a malformed token without hitting the database', async () => {
    expect(isPublicTokenShaped('short')).toBe(false)
    expect(isPublicTokenShaped("' OR 1=1 --")).toBe(false)
    expect(isPublicTokenShaped(liveToken)).toBe(true)

    const result = await lookupPublicDocument('short', 'ip-1')

    expect(result.status).toBe('not-found')
  })
})

describe('rate limit of the public lookup', () => {
  it('blocks after 30 attempts in the same window', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(registerPublicLookupAttempt('ip-flood', now).allowed).toBe(true)
    }

    const blocked = registerPublicLookupAttempt('ip-flood', now)

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not penalize another origin', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-flood', now)
    }

    expect(registerPublicLookupAttempt('ip-other', now).allowed).toBe(true)
  })

  it('allows again after the window', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-flood', now)
    }

    expect(registerPublicLookupAttempt('ip-flood', now).allowed).toBe(false)
    expect(
      registerPublicLookupAttempt('ip-flood', now + 61_000).allowed,
    ).toBe(true)
  })

  it('returns rate-limited on the lookup when the window overflows', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-lookup')
    }

    const result = await lookupPublicDocument(liveToken, 'ip-lookup')

    expect(result.status).toBe('rate-limited')
  })
})

describe('precedence with an organization', () => {
  it('an org member reads a document with org_access viewer', async () => {
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })

  it('an org member edits a document with org_access editor', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(owner)),
    ).resolves.toBe('editor')
  })

  it('an org admin does not see the private document of a member', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('the org owner does not see the private document of a member', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('the document owner stays owner even with a lower org_access', async () => {
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgMember)),
    ).resolves.toBe('owner')
  })

  it('an explicit share beats a more permissive org_access', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })

  it('an external guest only reaches the document shared with them', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(outsider)),
    ).resolves.toBe('viewer')
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('a member of another org does not reach a document of the other org', async () => {
    await expect(
      getDocumentAccess('doc-other-org', sessionFor(orgMember)),
    ).resolves.toBeNull()
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('a user without any organization does not reach an org document', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(stranger)),
    ).resolves.toBeNull()
  })

  it('a trashed document does not come back through org_access', async () => {
    await expect(
      getDocumentAccess('doc-org-trashed', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('a document without org_id ignores the organization of the requester', async () => {
    await expect(
      getDocumentAccess('doc-private', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('an org member comments on a document with org_access commenter', async () => {
    await expect(
      getDocumentAccess('doc-org-commenter', sessionFor(owner)),
    ).resolves.toBe('commenter')
  })

  it('an explicit share beats a less permissive org_access', async () => {
    await expect(
      getDocumentAccess('doc-org-commenter', sessionFor(orgAdmin)),
    ).resolves.toBe('editor')
  })

  it('a null org_access grants no access even with org_id filled in', async () => {
    await db
      .update(documents)
      .set({ orgAccess: null })
      .where(eq(documents.id, 'doc-org-viewer'))

    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })
})

describe('organizations', () => {
  it('returns the organization and the role of each person', async () => {
    await expect(getMembership(owner.id)).resolves.toMatchObject({
      orgId: mainOrg,
      orgName: 'Árvore School',
      role: 'owner',
    })
    await expect(getMembership(orgMember.id)).resolves.toMatchObject({
      role: 'member',
    })
    await expect(getMembership(stranger.id)).resolves.toBeNull()
  })

  it('canManageOrganization holds for owner and admin', () => {
    expect(canManageOrganization('owner')).toBe(true)
    expect(canManageOrganization('admin')).toBe(true)
    expect(canManageOrganization('member')).toBe(false)
    expect(canManageOrganization(null)).toBe(false)
  })

  it('lists the organization emails in lower case', async () => {
    const emails = await listOrganizationEmails(mainOrg)

    expect(emails).toEqual(
      expect.arrayContaining([owner.email, orgAdmin.email, orgMember.email]),
    )
    expect(emails).not.toContain(outsider.email)
  })

  it('lists only the org documents that are neither private nor trashed', async () => {
    const list = await listOrganizationDocuments(mainOrg)
    const ids = list.map((item) => item.id)

    expect(ids).toEqual(
      expect.arrayContaining(['doc-org-viewer', 'doc-org-editor']),
    )
    expect(ids).not.toContain('doc-org-private')
    expect(ids).not.toContain('doc-org-trashed')
    expect(ids).not.toContain('doc-other-org')
  })

  it('counts the other owners of the organization', async () => {
    await expect(otherOwnersInOrganization(mainOrg, owner.id)).resolves.toBe(0)
    await expect(otherOwnersInOrganization(mainOrg, orgMember.id)).resolves.toBe(
      1,
    )
  })

  it('leaving the org turns the documents of the person back to private', async () => {
    await detachMemberDocuments(mainOrg, orgMember.id)

    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgMember)),
    ).resolves.toBe('owner')
  })

  it('leaving the org does not touch the explicit share the person had given', async () => {
    await detachMemberDocuments(mainOrg, orgMember.id)

    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })
})

describe('organization invites', () => {
  it('turns the invite into a membership on the first access', async () => {
    await db.insert(organizationInvites).values({
      id: 'invite-1',
      orgId: mainOrg,
      email: stranger.email,
      role: 'admin',
      createdAt: new Date(),
    })

    await expect(
      acceptPendingInvites(stranger.id, stranger.email.toUpperCase()),
    ).resolves.toMatchObject([{ orgId: mainOrg, role: 'admin' }])

    const remaining = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, 'invite-1'),
    })

    expect(remaining).toBeUndefined()
  })

  it('someone who already has an organization also joins the second one', async () => {
    await db.insert(organizationInvites).values({
      id: 'invite-2',
      orgId: otherOrg,
      email: orgMember.email,
      role: 'admin',
      createdAt: new Date(),
    })

    const memberships = await acceptPendingInvites(
      orgMember.id,
      orgMember.email,
    )

    expect(memberships.map((item) => item.orgId).sort()).toEqual(
      [mainOrg, otherOrg].sort(),
    )

    const remaining = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, 'invite-2'),
    })

    expect(remaining).toBeUndefined()
  })

  it('without an invite, the access creates no organization', async () => {
    await expect(
      acceptPendingInvites(stranger.id, stranger.email),
    ).resolves.toEqual([])
  })

  it('limits the burst of invites per person', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(registerInviteAttempt('org:person', now).allowed).toBe(true)
    }

    expect(registerInviteAttempt('org:person', now).allowed).toBe(false)
    expect(registerInviteAttempt('org:other-person', now).allowed).toBe(true)
  })
})

import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { db } from '@/db'
import { invites } from '@/db/schemas'
import { BadRequestError } from '@/http/_errors/bad-request-errors'
import { UnauthorizedError } from '@/http/_errors/unauthorized-error'
import { auth } from '@/http/middlewares/auth'
import { getUserPermissions } from '@/utils/get-user-permissions'

export async function revokeInvite(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/groups/:groupId/invites/:inviteId/revoke',
      {
        schema: {
          tags: ['invite'],
          params: z.object({
            groupId: z.string(),
            inviteId: z.string().uuid(),
          }),
        },
      },
      async (req, res) => {
        const { sub: userId } = await req.getCurrentUserId()
        const { groupId, inviteId } = req.params
        const { membership } = await req.getUserMembership(groupId)

        const { cannot } = getUserPermissions(userId, membership)

        if (cannot('revoke', 'invite'))
          throw new UnauthorizedError(`you're not allowed to revoke invites`)

        const invite = await db
          .select()
          .from(invites)
          .where(and(eq(invites.id, inviteId), eq(invites.groupId, groupId)))

        if (!invite)
          throw new BadRequestError(`invite not found or already accepted`)

        await db.delete(invites).where(eq(invites.id, inviteId))

        return res.status(204).send()
      },
    )
}
import express from 'express';
import {
  isAuthorizedAdmin,
  evaluateClaimRisk,
  evaluateHighValueAndDispute,
  isValidClaimStatusTransition,
  createUserNotification,
  createAuditEntry,
  RISK_LEVELS,
} from './claimWorkflow.js';

export const claimRoutes = express.Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/claims
 * Creates a new claim from a lost report owner for a found report.
 */
claimRoutes.post('/claims', async (req, res) => {
  const { foundItemId, lostItemId, claimMessage, privateProof = {} } = req.body;
  const claimantId = req.user.id;
  const userSupabase = req.userSupabase;

  // 1. Input Validation
  if (!foundItemId || !UUID_V4_REGEX.test(foundItemId.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid foundItemId UUID v4 is required.' });
  }
  if (!lostItemId || !UUID_V4_REGEX.test(lostItemId.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid lostItemId UUID v4 is required.' });
  }
  if (foundItemId.trim() === lostItemId.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Found item and lost item cannot be the same report.' });
  }
  if (!claimMessage || typeof claimMessage !== 'string' || claimMessage.trim().length < 5) {
    return res.status(400).json({ error: 'Bad Request', message: 'Claim explanation message must be at least 5 characters.' });
  }

  try {
    // 2. Fetch and verify ownership of the lost report
    const { data: lostItem, error: lostError } = await userSupabase
      .from('items')
      .select('*')
      .eq('id', lostItemId.trim())
      .single();

    if (lostError || !lostItem) {
      return res.status(404).json({ error: 'Not Found', message: 'Lost item report not found.' });
    }

    if (lostItem.user_id !== claimantId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only claim items using a lost report that you personally own.' });
    }

    if (lostItem.item_type !== 'lost') {
      return res.status(400).json({ error: 'Bad Request', message: 'The report selected as your item must be of type "lost".' });
    }

    if (lostItem.status !== 'open') {
      return res.status(400).json({ error: 'Ineligible Status', message: `Your lost report is currently "${lostItem.status}". Only active "open" reports can claim items.` });
    }

    // 3. Fetch and verify eligibility of the found report
    const { data: foundItem, error: foundError } = await userSupabase
      .from('items')
      .select('*')
      .eq('id', foundItemId.trim())
      .single();

    if (foundError || !foundItem) {
      return res.status(404).json({ error: 'Not Found', message: 'Found item report not found.' });
    }

    if (foundItem.item_type !== 'found') {
      return res.status(400).json({ error: 'Bad Request', message: 'Target item must be a "found" report.' });
    }

    if (foundItem.user_id === claimantId) {
      return res.status(400).json({ error: 'Bad Request', message: 'You cannot claim a found report that you reported yourself.' });
    }

    if (foundItem.status !== 'open') {
      return res.status(400).json({ error: 'Ineligible Status', message: `Found report is currently "${foundItem.status}" and cannot accept new claims.` });
    }

    // 4. Check for duplicate active claims by this claimant for this found item
    const { data: existingClaims, error: claimsError } = await userSupabase
      .from('item_claims')
      .select('id, claimant_id, status')
      .eq('found_item_id', foundItemId.trim());

    if (claimsError && claimsError.code !== 'PGRST116') {
      console.warn('[Claims API] Error checking existing claims:', claimsError.message);
    }

    const claimantActive = (existingClaims || []).some(
      (c) => c.claimant_id === claimantId && ['pending', 'under_review', 'approved'].includes(c.status)
    );
    if (claimantActive) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You already have an active claim submitted for this found item.',
      });
    }

    // Count active competing claims for dispute detection
    const activeCompetingCount = (existingClaims || []).filter(
      (c) => ['pending', 'under_review', 'approved', 'disputed'].includes(c.status)
    ).length;

    // 5. Evaluate Risk-Based Classification
    const { riskLevel, requiresAdminReview, reason: reviewReason, isDisputed, isSensitive } = evaluateClaimRisk(
      foundItem,
      activeCompetingCount
    );

    const initialStatus = requiresAdminReview ? 'under_review' : 'pending';

    // 6. Insert Claim Record with structured Audit Trail
    const initialAudit = [
      createAuditEntry({
        actorId: claimantId,
        actorEmail: req.user.email,
        actorRole: 'claimant',
        action: 'claim_created',
        reason: 'Ownership claim submitted with private proof',
        details: {
          riskLevel,
          isSensitive,
          requiresAdminReview,
          isDisputed,
          competingClaimsCount: activeCompetingCount,
        },
      }),
    ];

    const proofPayload = {
      ...(typeof privateProof === 'object' && privateProof !== null ? privateProof : { text: String(privateProof) }),
      riskLevel,
      auditTrail: initialAudit,
    };

    const { data: newClaim, error: insertError } = await userSupabase
      .from('item_claims')
      .insert([
        {
          found_item_id: foundItemId.trim(),
          lost_item_id: lostItemId.trim(),
          claimant_id: claimantId,
          status: initialStatus,
          claim_message: claimMessage.trim(),
          private_proof: proofPayload,
          requires_admin_review: requiresAdminReview,
          decision_reason: reviewReason,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('[Claims API] Failed to insert claim:', insertError.message);
      return res.status(500).json({ error: 'Database Error', message: 'Failed to record claim.' });
    }

    // 7. Notify Finder (and alert if disputed / on hold)
    const finderMessage = isDisputed
      ? `A new competing claim was submitted for your found item "${foundItem.title}". It has been placed on hold for admin review.`
      : `A new ownership claim has been submitted for your found item "${foundItem.title}". You can review the details and approve directly.`;

    await createUserNotification(userSupabase, {
      recipientId: foundItem.user_id,
      type: isDisputed ? 'claim_disputed' : 'claim_created',
      claimId: newClaim.id,
      message: finderMessage,
    });

    return res.status(201).json({
      success: true,
      claim: newClaim,
      message: requiresAdminReview
        ? 'Claim submitted successfully. Because competing claims exist, it has been placed on hold for admin verification.'
        : 'Claim submitted successfully. The finder has been notified to review and coordinate return.',
    });
  } catch (err) {
    console.error('[Claims API] Exception:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'An unexpected error occurred while creating the claim.' });
  }
});

/**
 * GET /api/claims
 * Retrieves incoming, outgoing, and (if admin) review-queue and all-claims monitoring list.
 */
claimRoutes.get('/claims', async (req, res) => {
  const userId = req.user.id;
  const userSupabase = req.userSupabase;
  const isAdmin = isAuthorizedAdmin(req.user);

  try {
    // 1. Fetch outgoing claims (claims created by current user)
    const { data: outgoing, error: outError } = await userSupabase
      .from('item_claims')
      .select(`
        *,
        found_item:items!found_item_id(id, title, category, color, status, location_description, incident_date, image_path, user_id),
        lost_item:items!lost_item_id(id, title, status)
      `)
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });

    if (outError) {
      console.error('[Claims API] Error fetching outgoing claims:', outError.message);
    }

    // 2. Fetch incoming claims (claims targeting found items owned by current user)
    const { data: userFoundItems } = await userSupabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .eq('item_type', 'found');

    const foundItemIds = (userFoundItems || []).map((i) => i.id);
    let incoming = [];

    if (foundItemIds.length > 0) {
      const { data: incData, error: incError } = await userSupabase
        .from('item_claims')
        .select(`
          *,
          found_item:items!found_item_id(id, title, category, color, status, image_path),
          lost_item:items!lost_item_id(id, title, incident_date, location_description)
        `)
        .in('found_item_id', foundItemIds)
        .order('created_at', { ascending: false });

      if (incError) {
        console.error('[Claims API] Error fetching incoming claims:', incError.message);
      } else {
        incoming = incData || [];
      }
    }

    // 3. Fetch Admin Queue & Complete Monitoring dataset if user has admin privileges
    let adminQueue = [];
    let allClaims = [];

    if (isAdmin) {
      const adminClient = req.serviceSupabase || userSupabase;
      
      // Admin Queue: claims requiring intervention (under_review, disputed, or requires_admin_review)
      const { data: queueData, error: queueError } = await adminClient
        .from('item_claims')
        .select(`
          *,
          found_item:items!found_item_id(id, title, category, color, status, location_description, incident_date, image_path, user_id),
          lost_item:items!lost_item_id(id, title, category, color, status, location_description, incident_date, user_id)
        `)
        .or('requires_admin_review.eq.true,status.in.(under_review,disputed)')
        .order('created_at', { ascending: false });

      if (queueError) {
        console.error('[Claims API] Error fetching admin queue:', queueError.message);
      } else {
        adminQueue = queueData || [];
      }

      // All Claims: comprehensive platform-wide view for admin monitoring
      const { data: allData, error: allError } = await adminClient
        .from('item_claims')
        .select(`
          *,
          found_item:items!found_item_id(id, title, category, color, status, location_description, incident_date, image_path, user_id),
          lost_item:items!lost_item_id(id, title, category, color, status, location_description, incident_date, user_id)
        `)
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('[Claims API] Error fetching all claims for monitoring:', allError.message);
      } else {
        allClaims = allData || [];
      }
    }

    // 4. Attach associated handover coordination details
    const allClaimIds = [
      ...(outgoing || []).map((c) => c.id),
      ...(incoming || []).map((c) => c.id),
      ...(adminQueue || []).map((c) => c.id),
      ...(allClaims || []).map((c) => c.id),
    ];

    let handoversByClaimId = {};
    if (allClaimIds.length > 0) {
      const handoverClient = (isAdmin && req.serviceSupabase) ? req.serviceSupabase : userSupabase;
      const { data: handovers } = await handoverClient
        .from('item_handovers')
        .select('*')
        .in('claim_id', allClaimIds);

      (handovers || []).forEach((h) => {
        handoversByClaimId[h.claim_id] = h;
      });
    }

    // Attach handover object to each claim
    const attachHandover = (claimList) =>
      (claimList || []).map((c) => ({
        ...c,
        handover: handoversByClaimId[c.id] || null,
      }));

    return res.json({
      outgoing: attachHandover(outgoing),
      incoming: attachHandover(incoming),
      adminQueue: attachHandover(adminQueue),
      allClaims: attachHandover(allClaims),
      isAdmin,
    });
  } catch (err) {
    console.error('[Claims API] Error retrieving claims:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to retrieve claims.' });
  }
});

/**
 * PATCH /api/claims/:id/review
 * Finder or Admin review action (approve, reject, request_admin_review, request_evidence).
 */
claimRoutes.patch('/claims/:id/review', async (req, res) => {
  const claimId = req.params.id;
  const { action, reason = '', adminNotes = '' } = req.body;
  const userId = req.user.id;
  const userSupabase = req.userSupabase;
  const isAdmin = isAuthorizedAdmin(req.user);

  if (!claimId || !UUID_V4_REGEX.test(claimId.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid claimId UUID v4 is required.' });
  }

  const validActions = [
    'approve',
    'reject',
    'request_admin_review',
    'admin_approve',
    'admin_reject',
    'request_evidence',
    'admin_dispute',
    'admin_hold',
    'admin_release_hold',
    'admin_suspend_handover',
    'cancel',
  ];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: 'Bad Request', message: `Action must be one of: ${validActions.join(', ')}` });
  }

  // Use userSupabase (enforcing RLS) for non-admin claim lookup; allow serviceSupabase for verified admins
  const readClient = (isAdmin && req.serviceSupabase) ? req.serviceSupabase : userSupabase;
  const dbClient = req.serviceSupabase || userSupabase;

  try {
    // 1. Fetch claim and found item under RLS boundary
    const { data: claim, error: claimError } = await readClient
      .from('item_claims')
      .select('*, found_item:items!found_item_id(id, title, user_id, status)')
      .eq('id', claimId.trim())
      .single();

    if (claimError || !claim) {
      return res.status(404).json({ error: 'Not Found', message: 'Claim record not found or access denied.' });
    }

    const isFinder = claim.found_item && claim.found_item.user_id === userId;
    const isClaimant = claim.claimant_id === userId;

    // 2. Authorization check
    if (!isFinder && !isAdmin && !isClaimant) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to review this claim.' });
    }

    // Helper: append to structured audit trail in private_proof
    const appendAuditTrail = async (auditEntry) => {
      const currentProof = (typeof claim.private_proof === 'object' && claim.private_proof !== null)
        ? { ...claim.private_proof }
        : {};
      const auditTrail = Array.isArray(currentProof.auditTrail) ? [...currentProof.auditTrail] : [];
      auditTrail.push(auditEntry);
      currentProof.auditTrail = auditTrail;
      return currentProof;
    };

    // 3. Process Actions
    if (action === 'cancel') {
      if (!isClaimant && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Only the claimant or an admin can cancel this claim.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: isAdmin ? 'admin' : 'claimant',
          action: 'cancel',
          reason: reason || 'Cancelled by claimant',
          details: { previousStatus: claim.status, newStatus: 'cancelled' },
        })
      );

      const { error: cancelErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'cancelled',
          decision_reason: reason || 'Cancelled by claimant',
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (cancelErr) throw cancelErr;
      return res.json({ success: true, message: 'Claim cancelled.' });
    }

    // Finder Actions
    if (action === 'approve') {
      if (!isFinder && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Only the finder or an admin can approve this claim.' });
      }

      // If placed on mandatory admin hold or competing claims exist, finder cannot bypass
      if (claim.requires_admin_review && !isAdmin) {
        return res.status(403).json({
          error: 'Admin Review Required',
          message: 'This report has an active administrative hold or competing claim and requires verification by an authorized security reviewer before it can be approved.',
        });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: isAdmin ? 'admin' : 'finder',
          action: 'approve',
          reason: reason || 'Claim approved by finder',
          details: { previousStatus: claim.status, newStatus: 'approved' },
        })
      );

      // Advance claim to approved
      const { error: approveErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          decision_reason: reason || 'Claim approved by finder',
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (approveErr) throw approveErr;

      // Update both items status to 'matched'
      await dbClient.from('items').update({ status: 'matched' }).eq('id', claim.found_item_id);
      await dbClient.from('items').update({ status: 'matched' }).eq('id', claim.lost_item_id);

      // Create initial proposed handover record
      await dbClient.from('item_handovers').upsert(
        {
          claim_id: claimId,
          proposed_location: 'Campus Security Office / Main Reception',
          status: 'proposed',
        },
        { onConflict: 'claim_id' }
      );

      // Notify claimant
      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_approved',
        claimId,
        message: `Your claim for "${claim.found_item?.title || 'item'}" has been approved! You can now coordinate handover details.`,
      });

      return res.json({ success: true, message: 'Claim approved. Handover coordination is now open.' });
    }

    if (action === 'reject' || action === 'admin_reject') {
      if (action === 'admin_reject' && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (action === 'admin_reject' && (!reason || !reason.trim())) {
        return res.status(400).json({ error: 'Bad Request', message: 'Admin rejection requires a documented reason for the audit trail.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: isAdmin ? 'admin' : (isFinder ? 'finder' : 'claimant'),
          action: action === 'admin_reject' ? 'admin_reject' : 'reject',
          reason: reason || 'Claim rejected after verification review',
          details: { previousStatus: claim.status, newStatus: 'rejected' },
        })
      );

      const { error: rejectErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'rejected',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          decision_reason: reason || 'Claim rejected after verification review',
          admin_notes: adminNotes || (action === 'admin_reject' ? reason : null),
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (rejectErr) throw rejectErr;

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_rejected',
        claimId,
        message: `Your claim for "${claim.found_item?.title || 'item'}" was reviewed and not approved. Reason: ${reason || 'Details could not be verified'}`,
      });

      return res.json({ success: true, message: 'Claim marked as rejected.' });
    }

    if (action === 'request_admin_review') {
      if (!isFinder) {
        return res.status(403).json({ error: 'Forbidden', message: 'Only the finder can request admin review.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'finder',
          action: 'request_admin_review',
          reason: reason || 'Finder requested administrative security review',
          details: { previousStatus: claim.status, newStatus: 'under_review' },
        })
      );

      const { error: escErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'under_review',
          requires_admin_review: true,
          admin_notes: reason || 'Escalated by finder for security review',
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (escErr) throw escErr;

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_under_review',
        claimId,
        message: `Your claim for "${claim.found_item?.title || 'item'}" has been forwarded for administrative verification.`,
      });

      return res.json({ success: true, message: 'Claim escalated to admin security review.' });
    }

    if (action === 'admin_approve') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'Admin approval override requires a documented reason for the audit trail.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'admin_approve',
          reason: reason.trim(),
          details: { previousStatus: claim.status, newStatus: 'approved' },
        })
      );

      const { error: adminApproveErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'approved',
          requires_admin_review: false,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          decision_reason: reason.trim(),
          admin_notes: adminNotes || reason.trim(),
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (adminApproveErr) throw adminApproveErr;

      await dbClient.from('items').update({ status: 'matched' }).eq('id', claim.found_item_id);
      await dbClient.from('items').update({ status: 'matched' }).eq('id', claim.lost_item_id);

      await dbClient.from('item_handovers').upsert(
        {
          claim_id: claimId,
          proposed_location: 'Campus Security Office / Main Desk',
          status: 'proposed',
        },
        { onConflict: 'claim_id' }
      );

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_approved',
        claimId,
        message: `Your claim for "${claim.found_item?.title || 'item'}" has been authorized and approved by security staff! You may now coordinate handover.`,
      });

      await createUserNotification(dbClient, {
        recipientId: claim.found_item.user_id,
        type: 'admin_action',
        claimId,
        message: `A security reviewer authorized and approved the claim for your found report "${claim.found_item?.title || 'item'}".`,
      });

      return res.json({ success: true, message: 'Claim approved by admin. Handover opened.' });
    }

    if (action === 'admin_hold') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'Placing a claim on administrative hold requires a reason.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'admin_hold',
          reason: reason.trim(),
          details: { previousStatus: claim.status, newStatus: 'under_review' },
        })
      );

      const { error: holdErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'under_review',
          requires_admin_review: true,
          decision_reason: `Placed on administrative hold: ${reason.trim()}`,
          admin_notes: reason.trim(),
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (holdErr) throw holdErr;

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_under_review',
        claimId,
        message: `Your claim for "${claim.found_item?.title || 'item'}" was placed on administrative hold (${reason.trim()}).`,
      });

      await createUserNotification(dbClient, {
        recipientId: claim.found_item.user_id,
        type: 'admin_action',
        claimId,
        message: `Claim on your found item "${claim.found_item?.title || 'item'}" was placed on administrative hold (${reason.trim()}).`,
      });

      return res.json({ success: true, message: 'Claim placed on administrative hold.' });
    }

    if (action === 'admin_release_hold') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'Releasing an administrative hold requires a reason.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'admin_release_hold',
          reason: reason.trim(),
          details: { previousStatus: claim.status, newStatus: 'pending' },
        })
      );

      const { error: relErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'pending',
          requires_admin_review: false,
          decision_reason: `Administrative hold cleared: ${reason.trim()}`,
          admin_notes: `Hold cleared: ${reason.trim()}`,
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (relErr) throw relErr;

      await createUserNotification(dbClient, {
        recipientId: claim.found_item.user_id,
        type: 'admin_action',
        claimId,
        message: `Administrative hold cleared for "${claim.found_item?.title || 'item'}". You can now approve the claim directly.`,
      });

      return res.json({ success: true, message: 'Administrative hold cleared. Finder can now proceed directly.' });
    }

    if (action === 'admin_dispute') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'Marking a claim as disputed requires a documented reason.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'admin_dispute',
          reason: reason.trim(),
          details: { previousStatus: claim.status, newStatus: 'disputed' },
        })
      );

      const { error: dispErr } = await dbClient
        .from('item_claims')
        .update({
          status: 'disputed',
          requires_admin_review: true,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          decision_reason: reason.trim(),
          admin_notes: adminNotes || reason.trim(),
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      if (dispErr) throw dispErr;

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_disputed',
        claimId,
        message: `Security review update for "${claim.found_item?.title || 'item'}": The claim has been marked as disputed (${reason.trim()}).`,
      });

      await createUserNotification(dbClient, {
        recipientId: claim.found_item.user_id,
        type: 'claim_disputed',
        claimId,
        message: `A claim on your found item "${claim.found_item?.title || 'item'}" has been marked as disputed by security administration (${reason.trim()}).`,
      });

      return res.json({ success: true, message: 'Claim marked as disputed by security administration.' });
    }

    if (action === 'admin_suspend_handover') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'Suspending a handover requires a safety/fraud reason.' });
      }

      // Check if an active handover exists for this claim
      const { data: handover } = await dbClient
        .from('item_handovers')
        .select('*')
        .eq('claim_id', claimId)
        .maybeSingle();

      if (handover) {
        await dbClient
          .from('item_handovers')
          .update({
            status: 'suspended',
            notes: `Suspended by security reviewer: ${reason.trim()}`,
          })
          .eq('id', handover.id);
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'admin_suspend_handover',
          reason: reason.trim(),
          details: { handoverId: handover?.id || null, previousHandoverStatus: handover?.status },
        })
      );

      await dbClient
        .from('item_claims')
        .update({
          status: 'under_review',
          requires_admin_review: true,
          admin_notes: `Handover suspended by admin: ${reason.trim()}`,
          decision_reason: `Handover suspended: ${reason.trim()}`,
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'admin_action',
        claimId,
        message: `URGENT: Handover for "${claim.found_item?.title || 'item'}" has been suspended by administration. Reason: ${reason.trim()}`,
      });

      await createUserNotification(dbClient, {
        recipientId: claim.found_item.user_id,
        type: 'admin_action',
        claimId,
        message: `URGENT: Handover for your found item "${claim.found_item?.title || 'item'}" has been suspended by administration. Reason: ${reason.trim()}`,
      });

      return res.json({ success: true, message: 'Handover suspended and parties notified.' });
    }

    if (action === 'request_evidence') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
      }

      const updatedProof = await appendAuditTrail(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'request_evidence',
          reason: reason || adminNotes || 'Additional proof requested by reviewer',
          details: { previousStatus: claim.status },
        })
      );

      await dbClient
        .from('item_claims')
        .update({
          status: 'under_review',
          admin_notes: adminNotes || reason || 'Additional proof requested by reviewer',
          private_proof: updatedProof,
        })
        .eq('id', claimId);

      await createUserNotification(dbClient, {
        recipientId: claim.claimant_id,
        type: 'claim_under_review',
        claimId,
        message: `Security review update for "${claim.found_item?.title}": Additional proof requested (${adminNotes || reason || 'Please provide distinctive details'}).`,
      });

      return res.json({ success: true, message: 'Evidence request logged and claimant notified.' });
    }

    return res.status(400).json({ error: 'Bad Request', message: 'Unhandled action.' });
  } catch (err) {
    console.error('[Claims Review API] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to process claim review action.' });
  }
});

/**
 * POST /api/handovers/:id/coordinate
 * Propose or update private handover details (location, date/time, notes).
 */
claimRoutes.post('/handovers/:id/coordinate', async (req, res) => {
  const handoverId = req.params.id;
  const { proposedLocation, scheduledAt, notes } = req.body;
  const userId = req.user.id;
  const userSupabase = req.userSupabase;
  const isAdmin = isAuthorizedAdmin(req.user);
  const readClient = (isAdmin && req.serviceSupabase) ? req.serviceSupabase : userSupabase;
  const dbClient = req.serviceSupabase || userSupabase;

  if (!handoverId || !UUID_V4_REGEX.test(handoverId.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid handoverId UUID v4 is required.' });
  }
  if (!proposedLocation || proposedLocation.trim().length < 2) {
    return res.status(400).json({ error: 'Bad Request', message: 'Proposed location is required.' });
  }

  try {
    const { data: handover, error: hError } = await readClient
      .from('item_handovers')
      .select('*, claim:item_claims!claim_id(*, found_item:items!found_item_id(*))')
      .eq('id', handoverId.trim())
      .single();

    if (hError || !handover) {
      return res.status(404).json({ error: 'Not Found', message: 'Handover record not found or access denied.' });
    }

    const isClaimant = handover.claim?.claimant_id === userId;
    const isFinder = handover.claim?.found_item?.user_id === userId;

    if (!isClaimant && !isFinder && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not a participant in this handover.' });
    }

    if (handover.status === 'suspended' && !isAdmin) {
      return res.status(403).json({
        error: 'Handover Suspended',
        message: 'This handover has been suspended by administration. Meeting coordination is paused pending review.',
      });
    }

    const { data: updated, error: updateErr } = await dbClient
      .from('item_handovers')
      .update({
        proposed_location: proposedLocation.trim(),
        scheduled_at: scheduledAt || null,
        notes: notes ? notes.trim() : null,
        status: 'scheduled',
      })
      .eq('id', handoverId.trim())
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Append coordination entry to audit trail
    if (handover.claim) {
      const currentProof = handover.claim.private_proof || {};
      const auditTrail = Array.isArray(currentProof.auditTrail) ? [...currentProof.auditTrail] : [];
      auditTrail.push(
        createAuditEntry({
          actorId: userId,
          actorEmail: req.user.email,
          actorRole: isAdmin ? 'admin' : (isFinder ? 'finder' : 'claimant'),
          action: 'handover_scheduled',
          reason: 'Handover location and time scheduled',
          details: { proposedLocation: proposedLocation.trim(), scheduledAt },
        })
      );
      await dbClient
        .from('item_claims')
        .update({ private_proof: { ...currentProof, auditTrail } })
        .eq('id', handover.claim_id);
    }

    // Notify the other party
    const otherUserId = isClaimant ? handover.claim.found_item.user_id : handover.claim.claimant_id;
    await createUserNotification(dbClient, {
      recipientId: otherUserId,
      type: 'handover_scheduled',
      claimId: handover.claim_id,
      message: `Handover location proposed/updated: "${proposedLocation.trim()}". Check your dashboard to coordinate.`,
    });

    return res.json({ success: true, handover: updated });
  } catch (err) {
    console.error('[Handover Coordinate API] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to update handover details.' });
  }
});

/**
 * POST /api/handovers/:id/confirm
 * Dual-confirmation gate: Finder confirms handed over, Claimant confirms received.
 * When both are confirmed (and admin checks pass), triggers return completion!
 */
claimRoutes.post('/handovers/:id/confirm', async (req, res) => {
  const handoverId = req.params.id;
  const { confirmationType } = req.body; // 'finder_handed_over' | 'claimant_received'
  const userId = req.user.id;
  const userSupabase = req.userSupabase;
  const isAdmin = isAuthorizedAdmin(req.user);
  const readClient = (isAdmin && req.serviceSupabase) ? req.serviceSupabase : userSupabase;
  const dbClient = req.serviceSupabase || userSupabase;

  if (!handoverId || !UUID_V4_REGEX.test(handoverId.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid handoverId UUID v4 is required.' });
  }
  if (!['finder_handed_over', 'claimant_received'].includes(confirmationType)) {
    return res.status(400).json({ error: 'Bad Request', message: 'confirmationType must be "finder_handed_over" or "claimant_received".' });
  }

  try {
    const { data: handover, error: hError } = await readClient
      .from('item_handovers')
      .select('*, claim:item_claims!claim_id(*, found_item:items!found_item_id(*))')
      .eq('id', handoverId.trim())
      .single();

    if (hError || !handover) {
      return res.status(404).json({ error: 'Not Found', message: 'Handover record not found or access denied.' });
    }

    if (handover.status === 'suspended') {
      return res.status(403).json({
        error: 'Handover Suspended',
        message: 'This handover has been suspended by administration. Confirmations are temporarily blocked.',
      });
    }

    const isClaimant = handover.claim.claimant_id === userId;
    const isFinder = handover.claim.found_item.user_id === userId;

    if (confirmationType === 'finder_handed_over' && !isFinder) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the finder can confirm handing over the item.' });
    }
    if (confirmationType === 'claimant_received' && !isClaimant) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the claimant can confirm receiving the item.' });
    }

    const updateFields = {};
    if (confirmationType === 'finder_handed_over') {
      updateFields.finder_confirmed_at = new Date().toISOString();
    } else {
      updateFields.claimant_confirmed_at = new Date().toISOString();
    }

    // Check if after this update, BOTH parties have confirmed
    const finderWillBeConfirmed = Boolean(handover.finder_confirmed_at || updateFields.finder_confirmed_at);
    const claimantWillBeConfirmed = Boolean(handover.claimant_confirmed_at || updateFields.claimant_confirmed_at);

    // Append confirmation entry to audit trail
    const currentProof = handover.claim?.private_proof || {};
    const auditTrail = Array.isArray(currentProof.auditTrail) ? [...currentProof.auditTrail] : [];
    auditTrail.push(
      createAuditEntry({
        actorId: userId,
        actorEmail: req.user.email,
        actorRole: isFinder ? 'finder' : 'claimant',
        action: 'handover_confirmed',
        reason: `${confirmationType === 'finder_handed_over' ? 'Finder confirmed handing over' : 'Claimant confirmed receiving'} item`,
        details: { confirmationType, bothConfirmed: finderWillBeConfirmed && claimantWillBeConfirmed },
      })
    );

    if (finderWillBeConfirmed && claimantWillBeConfirmed) {
      // Check admin review requirement
      if (handover.claim.requires_admin_review && (!handover.claim.reviewed_by || handover.claim.status !== 'approved')) {
        return res.status(403).json({
          error: 'Admin Review Required',
          message: 'Cannot finalize return: High-value or contested item requires authorized security review before return completion.',
        });
      }

      auditTrail.push(
        createAuditEntry({
          actorId: 'system',
          actorRole: 'system',
          action: 'completed',
          reason: 'Dual confirmation fulfilled by both finder and claimant. Item returned successfully.',
          details: { completedAt: new Date().toISOString() },
        })
      );

      // Safe Return Finalization: Call complete_item_return database RPC
      const { data: rpcResult, error: rpcError } = await dbClient.rpc('complete_item_return', {
        p_claim_id: handover.claim_id,
        p_handover_id: handoverId.trim(),
      });

      if (rpcError || (rpcResult && !rpcResult.success)) {
        const failureReason = rpcError ? rpcError.message : (rpcResult?.error || 'Atomic return finalization failed');
        console.error('[Handover Confirm] complete_item_return failed:', failureReason);
        return res.status(400).json({
          error: 'Return Completion Failed',
          message: failureReason,
        });
      }

      // Update audit trail on completed claim
      await dbClient.from('item_claims').update({
        private_proof: { ...currentProof, auditTrail },
      }).eq('id', handover.claim_id);

      // Notify both parties of final return completion
      await createUserNotification(dbClient, {
        recipientId: handover.claim.claimant_id,
        type: 'item_returned',
        claimId: handover.claim_id,
        message: `Success! Handover of "${handover.claim.found_item.title}" confirmed by both parties. Report is now closed as Returned.`,
      });

      await createUserNotification(dbClient, {
        recipientId: handover.claim.found_item.user_id,
        type: 'item_returned',
        claimId: handover.claim_id,
        message: `Success! Handover of "${handover.claim.found_item.title}" confirmed by both parties. Report is now closed as Returned.`,
      });

      return res.json({
        success: true,
        completed: true,
        message: 'Both parties confirmed handover! Item return completed and reports updated to Returned.',
      });
    }

    // Only one party has confirmed so far
    updateFields.status = 'handover_pending';
    const { data: updated, error: upErr } = await dbClient
      .from('item_handovers')
      .update(updateFields)
      .eq('id', handoverId.trim())
      .select()
      .single();

    if (upErr) throw upErr;

    await dbClient.from('item_claims').update({
      private_proof: { ...currentProof, auditTrail },
    }).eq('id', handover.claim_id);

    const waitingOn = confirmationType === 'finder_handed_over' ? 'claimant to confirm receipt' : 'finder to confirm handoff';
    const notifyOther = confirmationType === 'finder_handed_over' ? handover.claim.claimant_id : handover.claim.found_item.user_id;

    await createUserNotification(dbClient, {
      recipientId: notifyOther,
      type: 'handover_confirmed',
      claimId: handover.claim_id,
      message: `The ${confirmationType === 'finder_handed_over' ? 'finder has confirmed handing over' : 'claimant has confirmed receiving'} the item. Please confirm on your dashboard to finalize.`,
    });

    return res.json({
      success: true,
      completed: false,
      handover: updated,
      message: `Confirmation recorded. Waiting for ${waitingOn} to complete the return.`,
    });
  } catch (err) {
    console.error('[Handover Confirm API] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to record confirmation.' });
  }
});

/**
 * GET /api/notifications
 * Returns in-app notifications for the authenticated user.
 */
claimRoutes.get('/notifications', async (req, res) => {
  const userId = req.user.id;
  const userSupabase = req.userSupabase;

  try {
    const { data: notifications, error } = await userSupabase
      .from('user_notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const unreadCount = (notifications || []).filter((n) => !n.read_at).length;
    return res.json({ notifications: notifications || [], unreadCount });
  } catch (err) {
    console.error('[Notifications API] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to retrieve notifications.' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
claimRoutes.patch('/notifications/:id/read', async (req, res) => {
  const notifId = req.params.id;
  const userId = req.user.id;
  const userSupabase = req.userSupabase;

  try {
    const { error } = await userSupabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId)
      .eq('recipient_id', userId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[Notification Read API] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to update notification.' });
  }
});

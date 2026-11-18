/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ListMessage } from '@/components/lists/ListStates';
import { useJmapBulkSet, useJmapSet } from '@/data/mutations';
import { toast } from '@/hooks/use-toast';
import { errorMessage, friendlySetError } from '@/lib/jmapErrors';
import type { PermissionCheckers } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  MAIL_RULE_OBJECT,
  moveInOrder,
  pinnedRuleIds,
  positionPatches,
  reorderPositions,
  ruleIssues,
  type MailRule,
} from '../model';
import { ruleIssueMessage, ruleSentence, summarizeCustomRule, type SummaryContext } from '../summary';

export interface CustomRulePermissions {
  update: boolean;
  destroy: boolean;
}

interface CustomRuleListProps {
  rules: MailRule[];
  accountId: string;
  editHref: (id: string) => string;
  allowed: CustomRulePermissions;
  checkers: Pick<PermissionCheckers, 'hasPermission'>;
  summary: SummaryContext;
}

interface RowProps {
  rule: MailRule;
  index: number;
  count: number;
  href: string;
  sentence: string;
  issues: string[];
  sortable: boolean;
  allowed: CustomRulePermissions;
  busy: boolean;
  onMove: (from: number, to: number) => void;
  onToggle: (rule: MailRule, isEnabled: boolean) => void;
  onDelete: (rule: MailRule) => void;
}

function ruleName(rule: MailRule): string {
  return rule.name || rule.id;
}

function SortableRuleRow({
  rule,
  index,
  count,
  href,
  sentence,
  issues,
  sortable,
  allowed,
  busy,
  onMove,
  onToggle,
  onDelete,
}: RowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
    disabled: !sortable || busy,
    attributes: { roleDescription: t('mailRules.dnd.roleDescription', 'sortable rule') },
  });
  const name = ruleName(rule);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-start gap-2 border-t border-border bg-card px-3 py-3 first:border-t-0 sm:gap-3 sm:px-4',
        isDragging && 'relative z-10 rounded-xl shadow-lg',
        !rule.isEnabled && 'text-muted-foreground',
      )}
      data-testid="mail-rule-row"
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('mailRules.dragRule', 'Reorder {{name}}', { name })}
          className="mt-0.5 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-dim hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          to={href}
          className="block break-words text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </Link>
        <p className="break-words text-[13px] leading-relaxed text-muted-foreground">{sentence}</p>
        {issues.map((issue) => (
          <p key={issue} className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {issue}
          </p>
        ))}
      </div>
      <Switch
        className="mt-0.5"
        checked={rule.isEnabled}
        disabled={!allowed.update || busy}
        onCheckedChange={(checked) => onToggle(rule, checked)}
        aria-label={t('mailRules.enableRule', 'Enable {{name}}', { name })}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('list.actionsFor', 'Actions for {{label}}', { label: name })}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={href}>{allowed.update ? t('mailRules.edit', 'Edit') : t('mailRules.view', 'View')}</Link>
          </DropdownMenuItem>
          {sortable && (
            <>
              <DropdownMenuItem disabled={busy || index === 0} onSelect={() => onMove(index, index - 1)}>
                {t('mailRules.moveUp', 'Move up')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy || index === count - 1} onSelect={() => onMove(index, index + 1)}>
                {t('mailRules.moveDown', 'Move down')}
              </DropdownMenuItem>
            </>
          )}
          {allowed.destroy && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={busy}
                className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                onSelect={() => onDelete(rule)}
              >
                {t('list.delete', 'Delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function CustomRuleList({ rules, accountId, editHref, allowed, checkers, summary }: CustomRuleListProps) {
  const { t } = useTranslation();
  const bulk = useJmapBulkSet(MAIL_RULE_OBJECT);
  const single = useJmapSet(MAIL_RULE_OBJECT);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<MailRule | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const busy = bulk.isPending || single.isPending;
  const sortable = allowed.update && rules.length > 1;

  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const shown = pendingOrder
    ? pendingOrder.map((id) => byId.get(id)).filter((rule): rule is MailRule => !!rule)
    : rules;
  const order = shown.map((rule) => rule.id);
  const nameOf = (id: string | number) => {
    const rule = byId.get(String(id));
    return rule ? ruleName(rule) : String(id);
  };
  const positionOf = (id: string | number) => order.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('mailRules.dnd.picked', 'Picked up {{name}}, position {{position}} of {{count}}.', {
        name: nameOf(active.id),
        position: positionOf(active.id),
        count: order.length,
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t('mailRules.dnd.over', '{{name}} moved to position {{position}} of {{count}}.', {
            name: nameOf(active.id),
            position: positionOf(over.id),
            count: order.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('mailRules.dnd.dropped', '{{name}} dropped at position {{position}} of {{count}}.', {
            name: nameOf(active.id),
            position: positionOf(over.id),
            count: order.length,
          })
        : undefined,
    onDragCancel: ({ active }) =>
      t('mailRules.dnd.cancelled', 'Reordering cancelled, {{name}} returned to its position.', {
        name: nameOf(active.id),
      }),
  };

  const reorder = async (next: string[]) => {
    const changes = reorderPositions(rules, next, pinnedRuleIds(rules, checkers));
    if (changes === null) {
      toast({
        title: t('mailRules.reorderFailed', 'Could not reorder the rules'),
        description: t(
          'mailRules.reorderPinned',
          'This order would move a forwarding rule, and your account is not allowed to change forwarding rules.',
        ),
        variant: 'destructive',
      });
      return;
    }
    if (changes.size === 0) return;
    setPendingOrder(next);
    try {
      const outcome = await bulk.mutateAsync({ action: 'updateEach', patches: positionPatches(changes), accountId });
      const [failed] = Object.values(outcome.failed);
      if (failed) {
        toast({
          title: t('mailRules.reorderFailed', 'Could not reorder the rules'),
          description: friendlySetError(failed),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: t('mailRules.reorderFailed', 'Could not reorder the rules'),
        description: errorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setPendingOrder(null);
    }
  };

  const move = (from: number, to: number) => {
    const next = moveInOrder(order, from, to);
    if (next) void reorder(next);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || busy) return;
    move(order.indexOf(String(active.id)), order.indexOf(String(over.id)));
  };

  const toggle = async (rule: MailRule, isEnabled: boolean) => {
    try {
      const result = await single.mutateAsync({ update: { [rule.id]: { isEnabled } }, accountId });
      const notUpdated = result.notUpdated?.[rule.id];
      if (notUpdated) {
        toast({
          title: t('form.failedToSave', 'Failed to save.'),
          description: friendlySetError(notUpdated),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: t('form.failedToSave', 'Failed to save.'),
        description: errorMessage(err),
        variant: 'destructive',
      });
    }
  };

  const destroy = async (rule: MailRule) => {
    const failed = (description: string) =>
      toast({ title: t('form.failedToDelete', 'Failed to delete.'), description, variant: 'destructive' });
    try {
      const result = await single.mutateAsync({ destroy: [rule.id], accountId });
      const notDestroyed = result.notDestroyed?.[rule.id];
      if (notDestroyed) failed(friendlySetError(notDestroyed));
    } catch (err) {
      failed(errorMessage(err));
    }
  };

  if (rules.length === 0) {
    return (
      <ListMessage>{t('mailRules.noRules', 'No mail rules yet. Create one to sort, file or answer mail.')}</ListMessage>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: t(
              'mailRules.dnd.instructions',
              'To reorder a rule, press Space or Enter to pick it up, use the arrow keys to move it, then press Space or Enter again to drop it, or Escape to cancel.',
            ),
          },
        }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol
            className={cn('tile overflow-hidden p-0', busy && 'opacity-70')}
            aria-label={t('mailRules.ruleList', 'Mail rules')}
            aria-busy={busy}
          >
            {shown.map((rule, index) => (
              <SortableRuleRow
                key={rule.id}
                rule={rule}
                index={index}
                count={shown.length}
                href={editHref(rule.id)}
                sentence={ruleSentence(summary, summarizeCustomRule(summary, rule.body))}
                issues={ruleIssues(rule, checkers).map((issue) => ruleIssueMessage(t, issue))}
                sortable={sortable}
                allowed={allowed}
                busy={busy}
                onMove={move}
                onToggle={(target, isEnabled) => void toggle(target, isEnabled)}
                onDelete={setDeleting}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('mailRules.deleteTitle', 'Delete this rule?')}
        description={t(
          'list.deleteItemDescription',
          'Are you sure you want to delete {{label}}? This action cannot be undone.',
          {
            label: deleting ? ruleName(deleting) : '',
          },
        )}
        confirmLabel={t('list.delete', 'Delete')}
        variant="destructive"
        onConfirm={() => (deleting ? destroy(deleting) : undefined)}
      />
    </>
  );
}

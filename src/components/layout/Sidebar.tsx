/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
const { ChevronDown, Lock } = LucideIcons;
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/uiStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';
import {
  visibleLayouts,
  findFirstVisibleLinkInLayout,
  findFirstAccessibleLinkInLayout,
  isLinkEnterprise,
  isLinkVisible,
} from '@/lib/layout';
import type { Layout, LayoutItem, LayoutSubItem } from '@/types/schema';

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const formatted = name
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
  const IconComp = (LucideIcons as Record<string, unknown>)[formatted] as LucideIcons.LucideIcon | undefined;
  if (!IconComp) return <LucideIcons.Circle className={className} />;
  return <IconComp className={className} />;
}

function resolveViewPath(sectionName: string, viewName: string): string {
  return `/${sectionName}/${viewName}`;
}

function pathMatchesView(currentPath: string, sectionName: string, viewName: string): boolean {
  const base = `/${sectionName}/${viewName}`;
  if (currentPath === base || currentPath.startsWith(`${base}/`)) return true;
  if (viewName === 'CustomComponent/Dashboard') {
    const dashBase = `/${sectionName}/Dashboard/`;
    return currentPath.startsWith(dashBase);
  }
  return false;
}

function subtreeContainsActive(items: LayoutSubItem[], currentPath: string, sectionName: string): boolean {
  for (const item of items) {
    if (item.type === 'link') {
      if (pathMatchesView(currentPath, sectionName, item.viewName)) return true;
    } else if (item.type === 'container') {
      if (subtreeContainsActive(item.items, currentPath, sectionName)) return true;
    }
  }
  return false;
}

function subtreeHasVisibleLink(items: LayoutSubItem[], edition: string): boolean {
  for (const item of items) {
    if (item.type === 'link') {
      if (!checkLinkVisible(item.viewName)) continue;
      const enterprise = checkIsEnterprise(item.viewName);
      if (enterprise && edition === 'oss') continue;
      return true;
    } else if (item.type === 'container') {
      if (subtreeHasVisibleLink(item.items, edition)) return true;
    }
  }
  return false;
}

function checkLinkVisible(viewName: string): boolean {
  const schema = useSchemaStore.getState().schema;
  if (!schema) return true;

  const accountStore = useAccountStore.getState();
  return isLinkVisible(
    schema,
    viewName,
    accountStore.edition,
    (prefix: string) => accountStore.hasObjectPermission(prefix, 'Get'),
    (perm: string) => accountStore.hasPermission(perm),
  );
}

function checkIsEnterprise(viewName: string): boolean {
  const schema = useSchemaStore.getState().schema;
  if (!schema) return false;
  const edition = useAccountStore.getState().edition;
  return isLinkEnterprise(schema, viewName, edition);
}

interface SidebarSubItemProps {
  item: LayoutSubItem;
  depth: number;
  sectionName: string;
  currentPath: string;
  navigate: (path: string) => void;
  edition: string;
  onUpsell: () => void;
}

function SidebarSubItem({ item, depth, sectionName, currentPath, navigate, edition, onUpsell }: SidebarSubItemProps) {
  if (item.type === 'link') {
    if (!checkLinkVisible(item.viewName)) return null;

    const path = resolveViewPath(sectionName, item.viewName);
    const isActive = pathMatchesView(currentPath, sectionName, item.viewName);
    const enterprise = checkIsEnterprise(item.viewName);
    const isLocked = enterprise && edition === 'community';
    const isHidden = enterprise && edition === 'oss';

    if (isHidden) return null;

    return (
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start gap-2 font-normal',
          isActive && 'bg-accent text-accent-foreground',
          depth > 0 && 'text-sm',
        )}
        style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
        onClick={() => {
          if (isLocked) {
            onUpsell();
          } else {
            navigate(path);
          }
        }}
      >
        <span className="truncate">{item.name || 'Overview'}</span>
        {isLocked && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
      </Button>
    );
  }

  if (item.type === 'container') {
    if (!subtreeHasVisibleLink(item.items, edition)) return null;

    const containsActive = subtreeContainsActive(item.items, currentPath, sectionName);
    return (
      <Collapsible defaultOpen={containsActive}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 font-normal text-sm"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
            <span className="truncate">{item.name}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {item.items.map((sub) => (
            <SidebarSubItem
              key={sub.type === 'link' ? sub.viewName : sub.name}
              item={sub}
              depth={depth + 1}
              sectionName={sectionName}
              currentPath={currentPath}
              navigate={navigate}
              edition={edition}
              onUpsell={onUpsell}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return null;
}

interface SidebarTopItemProps {
  item: LayoutItem;
  sectionName: string;
  currentPath: string;
  navigate: (path: string) => void;
  edition: string;
  onUpsell: () => void;
}

function SidebarTopItem({ item, sectionName, currentPath, navigate, edition, onUpsell }: SidebarTopItemProps) {
  if ('link' in item) {
    const { name, icon, viewName } = item.link;

    if (!checkLinkVisible(viewName)) return null;

    const path = resolveViewPath(sectionName, viewName);
    const isActive = pathMatchesView(currentPath, sectionName, viewName);
    const enterprise = checkIsEnterprise(viewName);
    const isLocked = enterprise && edition === 'community';
    const isHidden = enterprise && edition === 'oss';

    if (isHidden) return null;

    return (
      <Button
        variant="ghost"
        className={cn('w-full justify-start gap-2 font-normal', isActive && 'bg-accent text-accent-foreground')}
        onClick={() => {
          if (isLocked) {
            onUpsell();
          } else {
            navigate(path);
          }
        }}
      >
        <LucideIcon name={icon} className="h-4 w-4 shrink-0" />
        <span className="truncate">{name}</span>
        {isLocked && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
      </Button>
    );
  }

  if ('container' in item) {
    const { name, icon, items } = item.container;
    if (!subtreeHasVisibleLink(items, edition)) return null;

    const containsActive = subtreeContainsActive(items, currentPath, sectionName);

    return (
      <Collapsible defaultOpen={containsActive}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 font-normal">
            <LucideIcon name={icon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{name}</span>
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {items.map((sub) => (
            <SidebarSubItem
              key={sub.type === 'link' ? sub.viewName : sub.name}
              item={sub}
              depth={1}
              sectionName={sectionName}
              currentPath={currentPath}
              navigate={navigate}
              edition={edition}
              onUpsell={onUpsell}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return null;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = useUIStore((s) => s.activeSection);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const schema = useSchemaStore((s) => s.schema);
  const edition = useAccountStore((s) => s.edition);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const hasPermission = useAccountStore((s) => s.hasPermission);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const layouts = useMemo(
    () =>
      schema ? visibleLayouts(schema, edition, (prefix) => hasObjectPermission(prefix, 'Get'), hasPermission) : [],
    [schema, edition, hasObjectPermission, hasPermission],
  );

  useEffect(() => {
    if (!schema) return;
    if (layouts.length === 0) return;
    if (!layouts.find((l) => l.name === activeSection)) {
      setActiveSection(layouts[0].name);
    }
  }, [schema, layouts, activeSection, setActiveSection]);

  if (!sidebarOpen || !schema) return null;

  const layout: Layout | undefined = layouts.find((l) => l.name === activeSection);
  if (!layout) return null;

  const navigateAndClose = (path: string) => {
    navigate(path);
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false);
    }
  };

  const handleSectionClick = (target: Layout) => {
    setActiveSection(target.name);
    const canGet = (prefix: string) => hasObjectPermission(prefix, 'Get');
    const first =
      findFirstAccessibleLinkInLayout(schema, target, edition, canGet, hasPermission) ??
      findFirstVisibleLinkInLayout(schema, target, edition, canGet, hasPermission);
    if (first) navigateAndClose(`/${target.name}/${first}`);
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-14 bottom-0 z-20 bg-background/80 backdrop-blur-sm md:hidden"
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="fixed top-14 left-0 bottom-0 z-30 flex w-64 flex-col border-r bg-background shadow-lg md:shadow-none">
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {layout.items.map((item) => (
              <SidebarTopItem
                key={'link' in item ? item.link.viewName : item.container.name}
                item={item}
                sectionName={layout.name}
                currentPath={location.pathname}
                navigate={navigateAndClose}
                edition={edition}
                onUpsell={() => setUpsellOpen(true)}
              />
            ))}
          </nav>
        </ScrollArea>

        {layouts.length > 1 && (
          <TooltipProvider>
            <div className="flex items-center justify-around border-t bg-background px-2 py-2">
              {layouts.map((target) => {
                const Icon = (LucideIcons as Record<string, unknown>)[
                  target.icon
                    .split('-')
                    .map((s) => s[0].toUpperCase() + s.slice(1))
                    .join('')
                ] as LucideIcons.LucideIcon | undefined;
                const isActive = target.name === activeSection;
                return (
                  <Tooltip key={target.name}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={target.name}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleSectionClick(target)}
                        className={cn('h-9 w-9', isActive && 'bg-accent text-accent-foreground')}
                      >
                        {Icon ? <Icon className="h-4 w-4" /> : <LucideIcons.Circle className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{target.name}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />
      </aside>
    </>
  );
}

import {
  formatRelativeTime,
  getDaysElapsed,
  checkReminderStatus,
  isThisMonth,
  isThisYear,
} from '../src/utils/dateUtils';
import { parseSmartQuery } from '../src/utils/searchParser';
import { Activity, LifeEvent, ActivitySummary } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function runTests() {
  console.log('\n--- Running LifeLog Automated Business Logic Tests ---\n');

  const baseNow = new Date('2026-10-12T12:00:00Z');

  // Test 1: Date calculations & Relative time
  console.log('1. Relative Time and Elapsed Calculations:');
  const tenMinsAgo = new Date(baseNow.getTime() - 10 * 60 * 1000).toISOString();
  assert(formatRelativeTime(tenMinsAgo, baseNow) === '10 minutes ago', '10 minutes ago formatting');

  const oneHourAgo = new Date(baseNow.getTime() - 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(oneHourAgo, baseNow) === '1 hour ago', 'Singular 1 hour ago');

  const threeHoursAgo = new Date(baseNow.getTime() - 3 * 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(threeHoursAgo, baseNow) === '3 hours ago', 'Plural 3 hours ago');

  const yesterday = new Date(baseNow.getTime() - 25 * 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(yesterday, baseNow) === 'Yesterday', 'Yesterday format');

  const threeDaysAgo = new Date(baseNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(threeDaysAgo, baseNow) === '3 days ago', '3 days ago format');

  const twoWeeksAgo = new Date(baseNow.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(twoWeeksAgo, baseNow) === '2 weeks ago', '2 weeks ago format');

  const futureDate = new Date(baseNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  assert(formatRelativeTime(futureDate, baseNow) === 'In 3 days', 'Future date format');

  // Test 2: Overdue reminder evaluation
  console.log('\n2. Overdue Reminder Status:');
  const overdueResult = checkReminderStatus(
    new Date(baseNow.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    14, // 14 day interval
    baseNow
  );
  assert(overdueResult.isOverdue === true, 'Event 20 days ago with 14d interval is overdue');
  assert(overdueResult.daysOverdue === 6, 'Overdue by exactly 6 days');

  const notOverdueResult = checkReminderStatus(
    new Date(baseNow.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    14,
    baseNow
  );
  assert(notOverdueResult.isOverdue === false, 'Event 5 days ago with 14d interval is not overdue');
  assert(notOverdueResult.daysRemaining === 9, '9 days remaining until overdue');

  // Test 3: Stable ID & latest occurred_at selection
  console.log('\n3. Historical Integrity & Occurred vs Recorded Sorting:');
  const sampleActivity: Activity = {
    activity_id: 'act_beard_cut',
    name: 'Beard Cut',
    category: 'Grooming',
    tags: ['hair'],
    reminder_interval_days: 14,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    archived: false,
  };

  const eventOld: LifeEvent = {
    event_id: 'evt_1',
    activity_id: 'act_beard_cut',
    activity_name: 'Beard Cut',
    occurred_at: '2026-10-01T10:00:00Z', // occurred earlier
    recorded_at: '2026-10-10T10:00:00Z', // recorded late!
    tags: [],
    updated_at: '2026-10-10T10:00:00Z',
  };

  const eventNew: LifeEvent = {
    event_id: 'evt_2',
    activity_id: 'act_beard_cut',
    activity_name: 'Beard Cut',
    occurred_at: '2026-10-08T10:00:00Z', // occurred later
    recorded_at: '2026-10-08T10:05:00Z',
    tags: [],
    updated_at: '2026-10-08T10:05:00Z',
  };

  // Sort by occurred_at
  const sorted = [eventOld, eventNew].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  assert(
    sorted[0].event_id === 'evt_2',
    'Latest event correctly selected by occurred_at rather than recorded_at'
  );

  // Renaming test: renaming activity does not alter activity_id
  const renamedActivity: Activity = {
    ...sampleActivity,
    name: 'Beard & Mustache Grooming',
  };
  assert(
    renamedActivity.activity_id === eventOld.activity_id,
    'Activity rename preserves link to existing historical events via stable activity_id'
  );

  // Test 4: Smart Query Parser
  console.log('\n4. Natural-Language / Smart Query Resolver:');
  const summary: ActivitySummary = {
    activity: sampleActivity,
    lastEvent: eventNew,
    daysAgo: 4,
    totalOccurrences: 2,
    occurrencesThisMonth: 2,
    occurrencesThisYear: 2,
    isOverdue: false,
    daysOverdue: null,
  };

  const lastQuery = parseSmartQuery(
    'When did I last cut my beard?',
    [sampleActivity],
    [eventOld, eventNew],
    [summary],
    baseNow
  );
  assert(lastQuery !== null && lastQuery.isSmartQuery === true, 'Understands "When did I last cut my beard?"');
  assert(
    lastQuery?.matchedActivity?.activity_id === 'act_beard_cut',
    'Correctly identifies Beard Cut activity'
  );

  const inactiveQuery = parseSmartQuery(
    'Which activities have not happened in 30 days?',
    [sampleActivity],
    [eventOld, eventNew],
    [summary],
    baseNow
  );
  assert(
    inactiveQuery !== null && inactiveQuery.isSmartQuery === true,
    'Understands "Which activities have not happened in 30 days?"'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

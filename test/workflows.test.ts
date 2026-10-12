import { describe, expect, it } from 'vitest';
import release from '../.github/workflows/release.yml?raw';

describe('release workflow', () => {
  // A Release created with GITHUB_TOKEN triggers no other workflow, so hacs.yml never saw one:
  // the validation runs inside the release workflow, after the asset is up.
  it('validates the repository for HACS once the Release is published', () => {
    expect(release).toMatch(/\n  hacs:\n[\s\S]*needs: release[\s\S]*uses: hacs\/action@main[\s\S]*category: plugin/);
  });
});

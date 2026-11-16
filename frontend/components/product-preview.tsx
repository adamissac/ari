import styles from './landing.module.css';

/** Illustrative evidence, never presented as a recorded assessment or a customer result. */
export function ProductPreview() {
  return (
    <figure className={styles.preview} aria-labelledby="preview-caption">
      <figcaption id="preview-caption" className={styles.previewBar}>
        <span>From finding to repair</span>
        <span className={styles.sampleLabel}>Illustrative example</span>
      </figcaption>
      <div className={styles.previewMain}>
        <div className={styles.finding}>
          <p className={styles.findingCategory}><span aria-hidden="true" />Access control</p>
          <h2>A small check.<br />A critical boundary.</h2>
          <p>A customer should only be able to read their own transfers. This example adds the missing ownership check.</p>
          <span className={styles.fileRef}>payments/routes.py</span>
        </div>
        <div className={styles.codePanel}>
          <div className={styles.codeHeader}><span>Proposed change</span><span>Python</span></div>
          <pre className={styles.diff} aria-label="Example repair adds an ownership check before returning a transfer"><code>
            <span>{'  transfer = store.get_transfer(transfer_id)'}</span>
            <span className={styles.removed}>{'- return transfer'}</span>
            <span className={styles.added}>{'+ if transfer.owner_id != user.id:'}</span>
            <span className={styles.added}>{'+     raise HTTPException(status_code=404)'}</span>
            <span className={styles.added}>{'+ return transfer'}</span>
          </code></pre>
          <div className={styles.exampleEvidence}>
            <span className={styles.evidenceCheck} aria-hidden="true">✓</span>
            <div><strong>Independent re-test</strong><p>In this example, the cross-account request is blocked after the repair.</p></div>
          </div>
        </div>
      </div>
      <div className={styles.previewFooter}>
        <span>Understand the intent</span><span aria-hidden="true">→</span>
        <span>Reproduce the issue</span><span aria-hidden="true">→</span>
        <span>Verify the repair</span>
      </div>
    </figure>
  );
}

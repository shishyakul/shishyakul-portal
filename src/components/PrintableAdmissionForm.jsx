import React from 'react';
import './PrintLayout.css';

export default function PrintableAdmissionForm({ student }) {
  if (!student) return null;

  const Field = ({ label, value }) => (
    <div className="paf-field">
      <div className="paf-label">{label}</div>
      <div className="paf-value">{value || '\u00A0'}</div>
    </div>
  );

  const TextAreaField = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
      <div className="paf-label">{label}</div>
      <div className="paf-textarea-value">{value || '\u00A0'}</div>
    </div>
  );

  const Checkbox = ({ label, checked }) => (
    <div className="paf-checkbox">
      <div className={`paf-box ${checked ? 'checked' : ''}`}></div>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="printable-admission-form">
      {/* PAGE 1: Core Information */}
      <div className="paf-page">
        <div className="paf-header">
          <img src="/logo.png" alt="Shishyakul" className="paf-logo" />
          <div className="paf-header-info">
            <div><strong>SHISHYAKUL</strong> | EMPOWER YOURSELF</div>
            <div>shishyakul@gmail.com | 98194 43674</div>
            <div>www.shishyakul.in | 99670 99858</div>
          </div>
        </div>

        <div className="paf-title">ADMISSION FORM</div>

        <div className="paf-section">
          <div className="paf-top-row">
            <div className="paf-top-fields">
              <div className="paf-section-header">Shishya's Bio</div>
              <div className="paf-grid">
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Full Name of Shishya" value={student.studentName} />
                </div>
                <Field label="Date of Birth" value={student.dob} />
                <Field label="Gender" value={student.gender} />
                <Field label="Contact Number" value={student.contactNo || student.contactNumber} />
                <Field label="Email Address" value={student.emailId || student.email} />
                <Field label="School Name" value={student.schoolName} />
                <Field label="Class & Board" value={`${student.standard || ''} ${student.board ? `(${student.board})` : ''}`} />
                <Field label="Aadhar Card No." value={student.aadharNo} />
                <Field label="Source of Enquiry" value={student.reference || student.howDidYouKnow} />
                <Field label="Armed / Police Force" value={student.isArmedForce ? 'YES' : 'NO'} />
              </div>
            </div>
            
            <div className="paf-photo-box">
              {student.photoDataUrl ? (
                <img src={student.photoDataUrl} className="paf-photo-img" alt="Photo" />
              ) : (
                <span className="paf-photo-placeholder">Paste Photo</span>
              )}
            </div>
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Family Background</div>
          <div className="paf-grid">
            <Field label="Father's Name" value={student.fatherName} />
            <Field label="Mother's Name" value={student.motherName} />
            <Field label="Father's Occupation" value={student.fatherOccupation} />
            <Field label="Mother's Occupation" value={student.motherOccupation} />
            <Field label="Father's Contact" value={student.fatherContact} />
            <Field label="Mother's Contact" value={student.motherContact} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Residential Address" value={student.address} />
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Sibling Information</div>
          <table className="paf-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Sr.</th>
                <th>Name of Sibling</th>
                <th style={{ width: '80px' }}>Age</th>
                <th>Studying / Working Details</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map(i => {
                const sib = (student.siblings || [])[i] || {};
                return (
                  <tr key={i}>
                    <td>{i + 1}.</td>
                    <td>{sib.name || ''}</td>
                    <td>{sib.age || ''}</td>
                    <td>{sib.studying || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer removed per user request */}
      </div>

      {/* PAGE 2: Profiling & Assessment */}
      <div className="paf-page">
        <div className="paf-header">
          <img src="/logo.png" alt="Shishyakul" className="paf-logo" />
          <div className="paf-header-info">
            <div><strong>SHISHYAKUL</strong> | ADMISSIONS</div>
            <div>Student Profiling & Assessment</div>
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Personal Assessment</div>
          
          <TextAreaField label="Describe Yourself (Personality & Traits)" value={student.describeSelf} />
          <TextAreaField label="Passions & Skills" value={student.passions} />
          <TextAreaField label="Career Goals & Dreams" value={student.careerGoals} />
          
          <div className="paf-grid" style={{ marginBottom: 12 }}>
            <div className="paf-field">
              <div className="paf-label">Strengths</div>
              <div className="paf-textarea-value" style={{ minHeight: 30 }}>{student.strengths || '\u00A0'}</div>
            </div>
            <div className="paf-field">
              <div className="paf-label">Areas to Improve</div>
              <div className="paf-textarea-value" style={{ minHeight: 30 }}>{student.improvements || '\u00A0'}</div>
            </div>
          </div>

          <TextAreaField label="Expectations from Shishyakul" value={student.expectations} />
          
          <div className="paf-grid" style={{ marginBottom: 12 }}>
            <Field label="Medical Conditions (If Any)" value={student.medicalConditions || 'None reported'} />
            <Field label="Emergency Contact Number" value={student.emergencyContact} />
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Batch Timings & Preferences</div>
          <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 12, lineHeight: 1.5 }}>
            Please select your preferred time slots. Allocated time slots will be on a first-come, first-served basis and will be applicable till June only. Final slots will be allotted by our teaching faculty to maximize the Shishya's academic performance.
          </p>
          <div className="paf-checkbox-group">
            <Checkbox label="02:00 PM - 04:00 PM" checked={student.preferredSlot?.includes('02:00')} />
            <Checkbox label="04:30 PM - 06:30 PM" checked={student.preferredSlot?.includes('04:30')} />
            <Checkbox label="07:00 PM - 09:00 PM" checked={student.preferredSlot?.includes('07:00')} />
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">GURU DAKSHINA</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: '#1f2937', textAlign: 'justify', padding: '0 10px' }}>
            <p style={{ marginBottom: 10 }}>SHISHYAKUL HAS A TRADITIONAL WAY OF EXPRESSING A SYMBOLIC GESTURE OF GRATITUDE, RESPECT & APPRECIATION TOWARDS OUR GURUS. ‘GURU DAKSHINA’ IS A WAY FOR THE STUDENT TO ACKNOWLEDGE & APPRECIATE THE INVALUABLE KNOWLEDGE IMPARTED BY GURUS.</p>
            <p><strong>I THE UNDERSIGNED STATE THAT I WILL GIVE MY 100% TO MY GURU & SHISHYAKUL. I PROMISE YOU THAT I WILL PAY MY GURU DAKSHINA WHENEVER I AM ASKED TOO.</strong></p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingRight: 40 }}>
            <div className="paf-sign-block" style={{ width: 200 }}>
              {student.shishyaSignature && (
                <img src={student.shishyaSignature} className="paf-sign-img" alt="Student Sign" />
              )}
              <div className="paf-sign-line">SHISHYA'S SIGN</div>
            </div>
          </div>
        </div>

        {/* Footer removed per user request */}
      </div>

      {/* PAGE 3: Financials & Declarations */}
      <div className="paf-page">
        <div className="paf-header">
          <img src="/logo.png" alt="Shishyakul" className="paf-logo" />
          <div className="paf-header-info">
            <div><strong>SHISHYAKUL</strong> | ADMISSIONS</div>
            <div>Financial Summary & Declarations</div>
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Fees Summary</div>
          <table className="paf-table">
            <thead>
              <tr>
                <th>Fee Component</th>
                <th>Amount</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Tuition Fees</strong></td>
                <td>₹ {student.tuitionFees || student.phase2Data?.courseFees || '0'}</td>
                <td style={{ color: '#6b7280' }}>Base Course Fee</td>
              </tr>
              <tr>
                <td><strong>Registration Fees</strong></td>
                <td>₹ {student.registrationFees || '500'}</td>
                <td style={{ color: '#6b7280' }}>Non-Refundable / One-time</td>
              </tr>
              <tr>
                <td><strong>Library / Book Fees</strong></td>
                <td>₹ {student.libraryFees || '1000'}</td>
                <td style={{ color: '#6b7280' }}>Refundable Deposit</td>
              </tr>
              <tr>
                <td><strong>Workout Facility</strong></td>
                <td>₹ {student.workoutFees || '199'}</td>
                <td style={{ color: '#6b7280' }}>Per Month</td>
              </tr>
              <tr>
                <td><strong>Discount Applied</strong></td>
                <td style={{ color: '#ea580c' }}>- ₹ {student.discount || student.phase2Data?.discount || '0'}</td>
                <td style={{ color: '#6b7280' }}>Deducted from Tuition</td>
              </tr>
              <tr style={{ background: '#f9fafb' }}>
                <td><strong>TOTAL PAYABLE AMOUNT</strong></td>
                <td><strong>₹ {student.totalFees || '0'}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">Declarations & Undertaking</div>
          <div className="paf-declarations">
            <strong>DECLARE:</strong>
            <ol style={{ marginTop: 10, lineHeight: 1.8 }}>
              <li>I UNDERSTAND THAT ADMISSION IS STRICTLY CONDITIONAL UPON THE FULL & TIMELY PAYMENT OF THE FEES.</li>
              <li>NON-PAYMENT WILL RESULT IN SUSPENSION & CANCELLATION OF ADMISSION OR ANY LEGAL ACTION.</li>
              <li>THE STUDENT AGREES TO FOLLOW ALL RULES, RESPECT ALL GURUS & STAFF & MAINTAIN PROPER DISCIPLINE AT ALL TIMES.</li>
              <li>I ACKNOWLEDGE THAT SHISHYAKUL IS NOT RESPONSIBLE FOR ANY LOSS OR THEFT OF ANY PERSONAL OR VALUABLE ITEMS SUCH AS MOBILES, WATCHES, BICYCLES ETC.</li>
              <li>I CONFIRM THAT ALL THE INFORMATION PROVIDED IS TRUE AND CORRECT TO THE BEST OF MY KNOWLEDGE.</li>
              <li>I FULLY ACCEPT THE ABOVE DECLARATION AND AGREE TO COMPLY WITHOUT EXCEPTION.</li>
            </ol>
          </div>
        </div>

        <div className="paf-signatures" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', marginTop: 80 }}>
          <div className="paf-sign-block" style={{ width: 250 }}>
            {student.adminSignatureAdmission && (
              <img src={student.adminSignatureAdmission} className="paf-sign-img" alt="Admin Sign" />
            )}
            <div className="paf-sign-line">ADMINISTRATIVE HEAD</div>
          </div>
          <div className="paf-sign-block" style={{ width: 250 }}>
            {student.parentSignatureAdmission && (
              <img src={student.parentSignatureAdmission} className="paf-sign-img" alt="Parent Sign" />
            )}
            <div className="paf-sign-line">PARENTS / GUARDIAN</div>
          </div>
        </div>

        {/* Footer removed per user request */}
      </div>

      {/* PAGE 4: Installments & References */}
      <div className="paf-page">
        <div className="paf-header">
          <img src="/logo.png" alt="Shishyakul" className="paf-logo" />
          <div className="paf-header-info">
            <div><strong>SHISHYAKUL</strong> | ADMISSIONS</div>
            <div>Installment Details & References</div>
          </div>
        </div>

        <div className="paf-section">
          <div className="paf-section-header">INSTALLMENT DETAILS</div>
          <div className="paf-grid" style={{ marginBottom: 16 }}>
            <Field label="TOTAL FEES" value={`₹ ${student.totalFees || '0'}`} />
            <Field label="TOTAL NO. OF INSTALLMENTS" value={student.installmentsCount || student.phase2Data?.installments || '1'} />
          </div>

          <table className="paf-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>SR.</th>
                <th>MONTH</th>
                <th>PAID</th>
                <th>MODE</th>
                <th>BALANCE</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Number(student.installmentsCount || student.phase2Data?.installments || 1) }).map((_, i) => {
                const inst = (student.installmentsData || [])[i] || {};
                
                // Calculate running balance dynamically
                let displayBalance = inst.balance;
                if (displayBalance === undefined || displayBalance === '') {
                  const totalPayable = Number(student.totalFees) || 0;
                  const sumPaidUpToHere = (student.installmentsData || [])
                    .slice(0, i + 1)
                    .reduce((acc, curr) => acc + Number(curr.paid || 0), 0);
                  displayBalance = Math.max(0, totalPayable - sumPaidUpToHere);
                }

                return (
                  <tr key={i}>
                    <td>{i + 1}.</td>
                    <td>{inst.month || '\u00A0'}</td>
                    <td>{inst.paid ? `₹ ${inst.paid}` : '\u00A0'}</td>
                    <td>{inst.mode || '\u00A0'}</td>
                    <td>{displayBalance !== undefined ? `₹ ${displayBalance}` : '\u00A0'}</td>
                    <td>{inst.details || '\u00A0'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="paf-section" style={{ marginTop: 40 }}>
          <div className="paf-section-header">REFERENCES</div>
          <table className="paf-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>SR. NO.</th>
                <th>NAME OF STUDENT</th>
                <th>CLASS (BATCH)</th>
                <th>CONTACT NO.</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map(i => {
                const ref = (student.referredStudents || [])[i] || {};
                return (
                  <tr key={i}>
                    <td>{i + 1}.</td>
                    <td>{ref.name || '\u00A0'}</td>
                    <td>{ref.class || '\u00A0'}</td>
                    <td>{ref.contact || '\u00A0'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 10, textAlign: 'center', marginTop: 12, color: '#6b7280', fontWeight: 600 }}>
            (NOTE: REFERENCE AMOUNT WILL BE CLEARED WHEN THE REFFERED PERSON CLEARS THE FIRST INSTALLMENT.)
          </div>
        </div>

        <div className="paf-section" style={{ marginTop: 40 }}>
          <div className="paf-section-header">ADDITIONAL INFORMATION</div>
          <div className="paf-grid" style={{ width: '60%' }}>
            <Field label="DATE OF JOINING" value={student.dateOfJoining || '\u00A0'} />
            <Field label="DATE OF LEAVING" value={student.dateOfLeaving || '\u00A0'} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: 20, fontSize: 16, fontWeight: 700, color: '#ea580c', letterSpacing: 2 }}>
          || जय हिन्द जय भारत ||
        </div>

        {/* Footer removed per user request */}
      </div>
    </div>
  );
}

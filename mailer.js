const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || 'goodyguys.support@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') : null;

// Configure Gmail SMTP Transporter
const createTransporter = () => {
  if (!GMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS
    }
  });
};

/**
 * Builds the responsive HTML email template for the customer
 */
const buildCustomerEmailHtml = (order) => {
  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding: 12px 14px; border-bottom: 1px solid #222222; vertical-align: top;">
        <strong style="color: #ffffff; font-size: 15px;">${item.productName || 'Custom Drop Item'}</strong>
        <div style="font-size: 13px; color: #a1a1aa; margin-top: 4px; line-height: 1.4;">
          ${item.customText ? `<div>✍️ Custom Text: <strong style="color: #ff3366;">"${item.customText}"</strong></div>` : ''}
          ${item.size ? `<div>• Size: ${item.size}</div>` : ''}
          ${item.shape ? `<div>• Shape: ${item.shape}</div>` : ''}
          ${item.placement ? `<div>• Print Placement: ${item.placement}</div>` : ''}
          ${item.mugSides ? `<div>• Print Sides: ${item.mugSides}</div>` : ''}
          ${item.material ? `<div>• Material Finish: ${item.material}</div>` : ''}
          ${item.customImageName ? `<div>• Uploaded Graphic: ${item.customImageName}</div>` : ''}
        </div>
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #222222; text-align: center; color: #e4e4e7; font-size: 14px; vertical-align: top;">
        ${item.quantity || 1}
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #222222; text-align: right; color: #ffffff; font-weight: 700; font-size: 14px; vertical-align: top;">
        ₹${((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString()}
      </td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed | GOODYGUYS Studio</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090b; padding: 30px 15px;">
      <tr>
        <td align="center">
          
          <!-- Email Container -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
            
            <!-- Header Brand Banner -->
            <tr>
              <td style="background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 30px 30px 24px; text-align: center; border-bottom: 1px solid #27272a;">
                <div style="font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #ffffff; margin-bottom: 4px;">
                  GOODY<span style="color: #ff1744;">GUYS</span>
                </div>
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #a1a1aa; text-transform: uppercase;">
                  CUSTOM APPAREL &bull; PRECISION LASER STUDIO
                </div>
              </td>
            </tr>

            <!-- Order Received Notification -->
            <tr>
              <td style="padding: 32px 30px 20px;">
                <div style="display: inline-block; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); color: #4ade80; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; margin-bottom: 14px;">
                  ✓ ORDER RECEIVED &amp; QUEUED
                </div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 10px;">
                  Your Custom Drop is Confirmed, ${order.customer.name}!
                </h1>
                <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
                  Thank you for creating with GOODYGUYS. Our workshop desk has received your specifications and queued them for fabrication.
                </p>
              </td>
            </tr>

            <!-- Order Reference Card -->
            <tr>
              <td style="padding: 0 30px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px 20px;">
                  <tr>
                    <td>
                      <div style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 700;">Order Reference</div>
                      <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-top: 2px; font-family: monospace;">#${order.id}</div>
                    </td>
                    <td align="right">
                      <div style="font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 700;">Payment Mode</div>
                      <div style="font-size: 14px; font-weight: 700; color: #4ade80; margin-top: 2px;">${order.paymentMethod}</div>
                    </td>
                  </tr>
                  ${order.upiTransactionId ? `
                  <tr>
                    <td colspan="2" style="padding-top: 10px; border-top: 1px solid #27272a; margin-top: 10px;">
                      <div style="font-size: 12px; color: #71717a;">UPI Transaction / UTR: <code style="color: #e4e4e7; font-weight: 700;">${order.upiTransactionId}</code></div>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </td>
            </tr>

            <!-- Items Ordered Table -->
            <tr>
              <td style="padding: 0 30px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #18181b;">
                      <th align="left" style="padding: 10px 14px; color: #71717a; font-size: 11px; text-transform: uppercase; font-weight: 800; border-radius: 8px 0 0 8px;">Product</th>
                      <th align="center" style="padding: 10px 14px; color: #71717a; font-size: 11px; text-transform: uppercase; font-weight: 800;">Qty</th>
                      <th align="right" style="padding: 10px 14px; color: #71717a; font-size: 11px; text-transform: uppercase; font-weight: 800; border-radius: 0 8px 8px 0;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Totals Breakdown -->
            <tr>
              <td style="padding: 0 30px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #27272a; padding-top: 14px;">
                  <tr>
                    <td style="color: #a1a1aa; font-size: 13px; padding-bottom: 6px;">Subtotal:</td>
                    <td align="right" style="color: #f4f4f5; font-size: 13px; padding-bottom: 6px;">₹${(order.subtotal || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="color: #a1a1aa; font-size: 13px; padding-bottom: 6px;">Campus Delivery:</td>
                    <td align="right" style="color: #4ade80; font-size: 13px; padding-bottom: 6px;">
                      ${order.shipping === 0 ? 'FREE (Campus Special)' : '₹' + order.shipping}
                    </td>
                  </tr>
                  ${order.couponCode ? `
                  <tr>
                    <td style="color: #a1a1aa; font-size: 13px; padding-bottom: 6px;">Coupon Applied:</td>
                    <td align="right" style="color: #4ade80; font-size: 13px; padding-bottom: 6px;">${order.couponCode}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color: #ffffff; font-size: 17px; font-weight: 900; padding-top: 8px; border-top: 1px solid #27272a;">Total Amount:</td>
                    <td align="right" style="color: #ff1744; font-size: 19px; font-weight: 900; padding-top: 8px; border-top: 1px solid #27272a;">₹${(order.total || 0).toLocaleString()}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Delivery Details Box -->
            <tr>
              <td style="padding: 0 30px 28px;">
                <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px 20px; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                  <strong style="color: #ffffff; display: block; margin-bottom: 4px;">📍 Campus Hand-Delivery Address:</strong>
                  ${order.customer.address}, ${order.customer.city} - ${order.customer.pincode}<br>
                  <span style="color: #71717a;">Campus Zone: Sathyabama Institute of Science and Technology, Chennai</span><br>
                  <span style="color: #71717a;">Contact WhatsApp: ${order.customer.phone}</span>
                </div>
              </td>
            </tr>

            <!-- Action Buttons: View Receipt & WhatsApp -->
            <tr>
              <td style="padding: 0 30px 32px; text-align: center;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="https://goodyguys-custom.netlify.app/orders/${order.id}/receipt" target="_blank" style="display: inline-block; background-color: #ff1744; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 26px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(255, 23, 68, 0.4);">
                        🖨️ View &amp; Print Bill Online
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 12px;">
                      <a href="https://wa.me/919036969700?text=Hi%20GOODYGUYS,%20I%20have%20a%20query%20about%20Order%20%23${order.id}" target="_blank" style="color: #4ade80; font-size: 13px; font-weight: 700; text-decoration: none;">
                        💬 Chat with Workshop on WhatsApp (+91 9036969700)
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer Compliance -->
            <tr>
              <td style="background-color: #09090b; padding: 22px 30px; text-align: center; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; line-height: 1.5;">
                GOODYGUYS Custom Apparel &amp; Precision Laser Studio<br>
                Sathyabama Institute of Science and Technology Campus, Jeppiaar Nagar, OMR, Chennai - 600119<br>
                Email: goodyguys.support@gmail.com &bull; Non-GST supply under CGST Act threshold exemption.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

/**
 * Builds the studio alert email for workshop personnel
 */
const buildWorkshopAlertHtml = (order) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #ffffff; color: #111111;">
      <h2 style="color: #ff1744;">⚡ New Order #${order.id} Placed!</h2>
      <p><strong>Customer:</strong> ${order.customer.name}</p>
      <p><strong>Email:</strong> ${order.customer.email}</p>
      <p><strong>Phone:</strong> ${order.customer.phone}</p>
      <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.city} - ${order.customer.pincode}</p>
      <p><strong>Total Amount:</strong> ₹${order.total} (${order.paymentMethod})</p>
      ${order.upiTransactionId ? `<p><strong>UPI UTR ID:</strong> ${order.upiTransactionId}</p>` : ''}
      <p><strong>Items:</strong></p>
      <ul>
        ${(order.items || []).map(i => `
          <li>
            <strong>${i.productName}</strong> x ${i.quantity}
            ${i.customText ? `(Text: "${i.customText}")` : ''}
            ${i.size ? `[Size: ${i.size}]` : ''}
            ${i.shape ? `[Shape: ${i.shape}]` : ''}
          </li>
        `).join('')}
      </ul>
      <p><a href="https://goodyguys-custom.netlify.app/admin">Open Studio Admin Dashboard →</a></p>
    </div>
  `;
};

/**
 * Automatically dispatches confirmation emails asynchronously
 */
const sendOrderConfirmationEmails = async (order) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Mailer] GMAIL_APP_PASSWORD not set in environment. Skipping live email dispatch.');
    return { success: false, reason: 'GMAIL_APP_PASSWORD missing' };
  }

  try {
    // 1. Email to Customer
    const customerMailPromise = transporter.sendMail({
      from: `"GOODYGUYS Studio" <${GMAIL_USER}>`,
      to: order.customer.email,
      subject: `Order Confirmed #${order.id} | GOODYGUYS Custom Studio`,
      html: buildCustomerEmailHtml(order)
    });

    // 2. Alert to Studio Admin
    const adminMailPromise = transporter.sendMail({
      from: `"GOODYGUYS Store" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: `⚡ [NEW ORDER] #${order.id} - ${order.customer.name} (₹${order.total})`,
      html: buildWorkshopAlertHtml(order)
    });

    await Promise.allSettled([customerMailPromise, adminMailPromise]);
    console.log(`✉️ [Mailer] Order confirmation emails sent for #${order.id}`);
    return { success: true };
  } catch (err) {
    console.warn('[Mailer] Error sending order emails:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendOrderConfirmationEmails
};

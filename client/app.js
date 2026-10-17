/**
 * Personal Expense Tracker - Frontend Application Logic
 * Tailscale Local-First Web App (Relative API Endpoints)
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. DOM Element References
    // -------------------------------------------------------------------------
    // Summary Metric Elements
    const totalSpendEl = document.getElementById('total-spend');
    const monthlySpendEl = document.getElementById('monthly-spend');
    const topCategoryEl = document.getElementById('top-category');
    const categoryBreakdownEl = document.getElementById('category-breakdown');

    // Form Elements
    const expenseForm = document.getElementById('expense-form');
    const titleInput = document.getElementById('title');
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');
    const expenseDateInput = document.getElementById('expense-date');
    const notesInput = document.getElementById('notes');
    const submitBtn = document.getElementById('submit-btn');
    const formMessageEl = document.getElementById('form-message');

    // Filter Controls
    const filterMonthInput = document.getElementById('filter-month');
    const filterCategorySelect = document.getElementById('filter-category');
    const filterSearchInput = document.getElementById('filter-search');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Table & Empty State Elements
    const expenseTable = document.getElementById('expense-table');
    const expenseList = document.getElementById('expense-list');
    const emptyStateEl = document.getElementById('empty-state');

    let messageTimer = null;
    let searchDebounceTimer = null;

    // -------------------------------------------------------------------------
    // 2. Formatting & Utility Helpers
    // -------------------------------------------------------------------------

    /** Formats a monetary number into clean Malaysian Ringgit display (RM 0.00) */
    function formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return `RM ${num.toFixed(2)}`;
    }

    /** Returns today's date formatted as YYYY-MM-DD */
    function getTodayString() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /** Sanitizes strings for safe insertion into innerHTML */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /** Maps category name to badge CSS class */
    function getCategoryBadgeClass(category) {
        switch (category) {
            case 'Food': return 'badge-food';
            case 'Transport': return 'badge-transport';
            case 'Utilities': return 'badge-utilities';
            case 'Academic/Supplies': return 'badge-academic';
            case 'Personal': return 'badge-personal';
            default: return 'badge-other';
        }
    }

    /** Displays non-intrusive feedback message */
    function showMessage(text, type = 'success') {
        if (!formMessageEl) return;
        if (messageTimer) clearTimeout(messageTimer);

        formMessageEl.textContent = text;
        formMessageEl.className = `form-message ${type}`;

        messageTimer = setTimeout(() => {
            formMessageEl.textContent = '';
            formMessageEl.className = 'form-message';
        }, 3500);
    }

    // -------------------------------------------------------------------------
    // 3. API Integration: Fetch Dashboard Summary (Relative URL)
    // -------------------------------------------------------------------------
    async function loadSummary() {
        try {
            const params = new URLSearchParams();
            if (filterMonthInput && filterMonthInput.value) {
                params.append('month', filterMonthInput.value);
            }

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`/api/summary${queryString}`);

            if (!res.ok) {
                throw new Error(`Failed to load summary: ${res.statusText}`);
            }

            const data = await res.json();

            // Update Metric Cards
            if (totalSpendEl) totalSpendEl.textContent = formatCurrency(data.total_spend);
            if (monthlySpendEl) monthlySpendEl.textContent = formatCurrency(data.monthly_spend);
            if (topCategoryEl) topCategoryEl.textContent = data.top_category || 'None';

            // Render Category Breakdown Chips
            if (categoryBreakdownEl) {
                const breakdown = data.category_breakdown || {};
                const categories = Object.keys(breakdown);

                if (categories.length === 0) {
                    categoryBreakdownEl.innerHTML = '<span style="font-size:0.875rem; color:var(--text-muted); font-style:italic;">No category data recorded yet.</span>';
                } else {
                    categoryBreakdownEl.innerHTML = categories.map(cat => {
                        const badgeClass = getCategoryBadgeClass(cat);
                        return `
                            <div class="breakdown-chip">
                                <span class="badge ${badgeClass}">${escapeHtml(cat)}</span>
                                <span class="chip-amount">${formatCurrency(breakdown[cat])}</span>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (err) {
            console.error('Error fetching summary:', err);
        }
    }

    // -------------------------------------------------------------------------
    // 4. API Integration: Fetch Expenses List (Relative URL)
    // -------------------------------------------------------------------------
    async function loadExpenses() {
        try {
            const params = new URLSearchParams();

            if (filterMonthInput && filterMonthInput.value) {
                params.append('month', filterMonthInput.value);
            }

            if (filterCategorySelect && filterCategorySelect.value && filterCategorySelect.value !== 'All') {
                params.append('category', filterCategorySelect.value);
            }

            if (filterSearchInput && filterSearchInput.value.trim()) {
                params.append('search', filterSearchInput.value.trim());
            }

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`/api/expenses${queryString}`);

            if (!res.ok) {
                throw new Error(`Failed to load expenses: ${res.statusText}`);
            }

            const expenses = await res.json();

            if (!expenseList) return;

            if (!expenses || expenses.length === 0) {
                expenseList.innerHTML = '';
                if (emptyStateEl) emptyStateEl.style.display = 'block';
                if (expenseTable) expenseTable.style.display = 'none';
            } else {
                if (emptyStateEl) emptyStateEl.style.display = 'none';
                if (expenseTable) expenseTable.style.display = 'table';

                expenseList.innerHTML = expenses.map(expense => {
                    const badgeClass = getCategoryBadgeClass(expense.category);
                    const notesDisplay = expense.notes
                        ? escapeHtml(expense.notes)
                        : '<span style="color:var(--text-muted);">-</span>';

                    return `
                        <tr data-row-id="${expense.id}">
                            <td class="date-cell">${escapeHtml(expense.expense_date)}</td>
                            <td class="title-cell">${escapeHtml(expense.title)}</td>
                            <td><span class="badge ${badgeClass}">${escapeHtml(expense.category)}</span></td>
                            <td class="notes-cell">${notesDisplay}</td>
                            <td class="amount-cell">${formatCurrency(expense.amount)}</td>
                            <td class="action-cell">
                                <button type="button" class="btn btn-danger btn-delete" data-id="${expense.id}" aria-label="Delete expense: ${escapeHtml(expense.title)}">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Error fetching expenses:', err);
            if (emptyStateEl) {
                emptyStateEl.textContent = 'Error loading expenses. Please try again.';
                emptyStateEl.style.display = 'block';
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. Form Submission: Add New Expense (POST /api/expenses)
    // -------------------------------------------------------------------------
    if (expenseForm) {
        expenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = titleInput ? titleInput.value.trim() : '';
            const amount = amountInput ? parseFloat(amountInput.value) : NaN;
            const category = categorySelect ? categorySelect.value : '';
            const expenseDate = expenseDateInput ? expenseDateInput.value : '';
            const notes = notesInput ? notesInput.value.trim() : '';

            // Client-side quick check
            if (!title || isNaN(amount) || amount < 0 || !category || !expenseDate) {
                showMessage('Please fill in all required fields with valid data.', 'error');
                return;
            }

            const payload = {
                title,
                amount,
                category,
                expense_date: expenseDate,
                notes
            };

            // Disable button during flight
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';
            }

            try {
                const res = await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to add expense');
                }

                // Reset form fields
                expenseForm.reset();
                if (expenseDateInput) expenseDateInput.value = getTodayString();

                showMessage('Expense added successfully!', 'success');

                // Refresh both table and metrics in parallel
                await Promise.all([loadExpenses(), loadSummary()]);
            } catch (err) {
                showMessage(err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Add Expense';
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // 6. Expense Deletion: Event Delegation (DELETE /api/expenses/<id>)
    // -------------------------------------------------------------------------
    if (expenseList) {
        expenseList.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (!deleteBtn) return;

            const id = deleteBtn.dataset.id;
            if (!id) return;

            // Optional confirmation for smooth UX
            const confirmDelete = window.confirm('Are you sure you want to delete this expense?');
            if (!confirmDelete) return;

            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';

            try {
                const res = await fetch(`/api/expenses/${id}`, {
                    method: 'DELETE'
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to delete expense');
                }

                showMessage('Expense deleted successfully.', 'success');
                await Promise.all([loadExpenses(), loadSummary()]);
            } catch (err) {
                showMessage(err.message, 'error');
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Delete';
            }
        });
    }

    // -------------------------------------------------------------------------
    // 7. Filter & Search Event Listeners
    // -------------------------------------------------------------------------
    if (filterMonthInput) {
        filterMonthInput.addEventListener('change', () => {
            loadExpenses();
            loadSummary();
        });
    }

    if (filterCategorySelect) {
        filterCategorySelect.addEventListener('change', () => {
            loadExpenses();
        });
    }

    if (filterSearchInput) {
        filterSearchInput.addEventListener('input', () => {
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadExpenses();
            }, 250);
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterMonthInput) filterMonthInput.value = '';
            if (filterCategorySelect) filterCategorySelect.value = 'All';
            if (filterSearchInput) filterSearchInput.value = '';

            loadExpenses();
            loadSummary();
        });
    }

    // -------------------------------------------------------------------------
    // 8. Initialization on Page Load
    // -------------------------------------------------------------------------
    if (expenseDateInput) {
        expenseDateInput.value = getTodayString();
    }

    // Initial data fetch
    loadSummary();
    loadExpenses();
});

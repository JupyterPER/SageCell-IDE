/* ── Sage Keywords ──────────────────────────────────────────────── */
  var SAGE_WORDS = {
		// Python keywords and built-ins
		python: [
			'False','None','True','and','as','assert','async','await','break',
			'class','continue','def','del','elif','else','except','finally',
			'for','from','global','if','import','in','is','lambda','nonlocal',
			'not','or','pass','raise','return','try','while','with','yield',
			'print()','range()','len()','list()','dict()','set()','tuple()',
			'int()','float()','str()','bool()','type()','isinstance()',
			'enumerate()','zip()','map()','filter()','sorted()','reversed()',
			'sum()','min()','max()','abs()','round()','input()','open()',
			'super()','property()','dir()','help()','hasattr()','getattr()',
			'setattr()','delattr()','vars()','globals()','locals()','callable()',
			'iter()','next()','id()','hash()','repr()','ascii()','bin()',
			'oct()','hex()','chr()','ord()','pow()','divmod()','format()',
			'slice()','memoryview()','bytearray()','bytes()','frozenset()',
			'complex()','object()','staticmethod()','classmethod()','eval()',
			'exec()','compile()','breakpoint()','exit()','quit()'
		],
		
		// Symbolic variables and basic symbolic
		symbolic: [
			'var()','SR','Expression','symbolic_expression()','hold()','forget()',
			'reset()','restore()','save()','load()','attach()','detach()',
			'sage_eval()','preparse()'
		],
		
		// Core calculus - limits, derivatives, integrals
		calculus: [
			// Limits and series
			'limit()','lim()','taylor()','series()','asymptotic_expansion()',
			'power_series()','laurent_series()','puiseux_series()',
			
			// Differentiation
			'diff()','derivative()','grad()','gradient()','hessian()',
			'jacobian()','laplacian()','curl()','divergence()',
			
			// Integration
			'integrate()','integral()','numerical_integral()','nintegrate()',
			'quad()','dblquad()','tplquad()',
			
			// Sums and products
			'sum()','prod()','product()','summation()',
			
			// Transforms and special
			'fourier_series()','fourier_transform()','inverse_fourier_transform()',
			'laplace()','inverse_laplace()','mellin_transform()',
			'convolution()','piecewise()'
		],
		
		// Methods called with dot notation on expressions/functions
		calculus_methods: [
			// Differentiation methods
			'.diff()','.derivative()','.grad()','.gradient()','.hessian()',
			'.jacobian()','.laplacian()','.curl()','.divergence()',
			
			// Integration methods
			'.integrate()','.integral()','.nintegrate()',
			
			// Limits and series
			'.limit()','.taylor()','.series()','.power_series()',
			'.laurent_series()','.puiseux_series()','.fourier_series()',
			
			// Expansion methods
			'.expand()','.expand_trig()','.expand_log()','.expand_rational()',
			'.expand_complex()','.expand_sum()','.expand_func()',
			
			// Simplification methods
			'.simplify()','.simplify_full()','.simplify_trig()',
			'.simplify_rational()','.simplify_log()','.simplify_radical()',
			'.simplify_factorial()','.simplify_hypergeometric()',
			'.canonicalize_radical()','.trig_simplify()','.log_simplify()',
			'.rational_simplify()','.radical_simplify()','.full_simplify()',
			
			// Factorization and collection
			'.factor()','.factor_list()','.collect()','.collect_common_factors()',
			
			// Coefficients and degrees
			'.coefficients()','.coeff()','.lc()','.lm()','.lt()',
			'.degree()','.total_degree()',
			
			// Substitution
			'.subs()','.substitute()','.subs_expr()','.substitute_function()',
			
			// Structural methods
			'.variables()','.arguments()','.operands()','.operator()',
			'.lhs()','.rhs()','.left()','.right()',
			'.numerator()','.denominator()','.numer()','.denom()',
			'.numerical_approx()','.n()','.N()','.approx()',
			
			// Partial fractions
			'.partial_fraction()','.partial_fraction_decomposition()',
			
			// Transforms
			'.laplace()','.inverse_laplace()','.fourier_transform()',
			'.inverse_fourier_transform()',
			
			// Evaluation
			'.eval()','.evalf()','.truncate()'
		],
		
		// Simplification and manipulation
		simplify: [
			'simplify()','simplify_full()','simplify_trig()',
			'simplify_rational()','simplify_log()','simplify_radical()',
			'simplify_factorial()','simplify_hypergeometric()',
			'canonicalize_radical()','trig_simplify()','log_simplify()',
			'radical_simplify()','rational_simplify()','full_simplify()',
			'expand()','expand_trig()','expand_log()','expand_rational()',
			'expand_complex()','expand_sum()','expand_func()',
			'factor()','factor_list()','collect()','combine()',
			'partial_fraction()','apart()','together()','cancel()',
			'ratsimp()','trigsimp()','logcombine()','powsimp()',
			'combsimp()','hypersimp()','nsimplify()',
			'round()','numerical_approx()','n()','N()'
		],
		
		// Algebra and equation solving
		algebra: [
			'solve()','solve_ineq()','solve_mod()','solve_diophantine()',
			'roots()','nroots()','find_root()','find_local_maximum()',
			'find_local_minimum()','find_fit()','fit()',
			'parametric_plot()','implicit_plot()',
			'factor()','expand()','collect()','combine()',
			'assume()','forget()','assumptions()','assuming()',
			'sqrt()','cbrt()','root()','real_root()','nth_root()',
			'log()','ln()','log2()','log10()','exp()','expm1()','log1p()',
			'sin()','cos()','tan()','sec()','csc()','cot()',
			'asin()','acos()','atan()','atan2()','acot()','asec()','acsc()',
			'sinh()','cosh()','tanh()','sech()','csch()','coth()',
			'asinh()','acosh()','atanh()','acoth()','asech()','acsch()',
			'pi','e','I','oo','infinity','NaN','nan',
			'EllipticE()','EllipticF()','EllipticPi()','EllipticK()',
			'gamma()','psi()','beta()','erf()','erfc()','erfi()','erfinv()',
			'bessel_J()','bessel_Y()','bessel_I()','bessel_K()',
			'hypergeometric()','hypergeometric_U()','hypergeometric_M()',
			'airy_ai()','airy_bi()','spherical_bessel_J()','spherical_bessel_Y()',
			'Rational()','Integer()','RealNumber()','ComplexNumber()',
			'QQ','ZZ','RR','CC','AA','QQbar','CDF','RDF','RIF','CIF',
			'binomial()','factorial()','double_factorial()',
			'falling_factorial()','rising_factorial()',
			'fibonacci()','lucas()','harmonic_number()',
			'bernoulli()','euler()','catalan()',
			'stirling_number1()','stirling_number2()',
			'bell_number()','partition()','partitions()',
			'gcd()','xgcd()','lcm()','mod()','power_mod()','inverse_mod()',
			'is_prime()','is_pseudoprime()','next_prime()','previous_prime()',
			'prime_range()','primes()','nth_prime()','prime_pi()','prime_power()',
			'euler_phi()','totient()','divisors()','sigma()','divisor_sigma()',
			'moebius()','moebius_mu()','li()','Li()','primezeta()',
			'continued_fraction()','convergents()','continued_fraction_list()',
			'quadratic_residues()','legendre_symbol()','jacobi_symbol()',
			'kronecker_symbol()','modular_symbol()','hecke_operator()','newform()'
		],
		
		// Linear algebra
		linalg: [
			'matrix()','Matrix','vector()','Vector()','vector_space()','VectorSpace()',
			'FreeModule()','identity_matrix()','zero_matrix()','ones_matrix()',
			'diagonal_matrix()','block_matrix()','block_diagonal_matrix()',
			'random_matrix()','companion_matrix()','hilbert_matrix()',
			'vandermonde_matrix()','toeplitz_matrix()','circulant_matrix()',
			'det()','rank()','trace()','transpose()','T','conjugate()','H',
			'eigenvalues()','eigenvectors()','eigenmatrix_left()','eigenmatrix_right()',
			'echelon_form()','rref()','hermite_form()','smith_form()',
			'kernel()','left_kernel()','right_kernel()','image()',
			'row_space()','column_space()',
			'nullity()','dimension()','degree()',
			'solve_right()','solve_left()','solve()','gauss_jordan_solve()',
			'cholesky()','LU()','QR()','SVD()','hessenberg_form()','jordan_form()',
			'rational_form()','primary_decomposition()','decomposition()',
			'characteristic_polynomial()','charpoly()',
			'minimal_polynomial()','minpoly()',
			'companion_matrix()','frobenius()',
			'norm()','norm2()','gram_schmidt()','augment()','stack()',
			'tensor_product()','kronecker_product()',
			'exponential()','log()','sqrtm()',
			'is_invertible()','is_symmetric()','is_hermitian()',
			'is_positive_definite()','is_diagonalizable()','is_nilpotent()',
			'PolynomialRing()','NumberField()','QuadraticField()','CyclotomicField()',
			'AbsoluteExtension()','RelativeExtension()','GaloisGroup()',
			'GF()','FiniteField()','Zp()','Qp()','SR','AA','QQbar','CDF','RDF'
		],
		
		// Matrix and vector methods (dot notation)
		linalg_methods: [
			// Transpose and conjugate
			'.T','.transpose()','.H','.conjugate()','.adjoint()',
			
			// Basic properties
			'.det()','.determinant()','.rank()','.trace()','.norm()',
			
			// Eigenvalues and polynomials
			'.eigenvalues()','.eigenvectors_left()','.eigenvectors_right()',
			'.charpoly()','.characteristic_polynomial()',
			'.minpoly()','.minimal_polynomial()',
			
			// Canonical forms
			'.rref()','.echelon_form()','.hermite_form()','.smith_form()',
			'.jordan_form()','.rational_form()','.hessenberg_form()',
			'.frobenius_form()',
			
			// Kernels and images
			'.kernel()','.left_kernel()','.right_kernel()',
			'.image()','.row_space()','.column_space()',
			
			// Solving
			'.solve_right()','.solve_left()','.gauss_jordan_solve()',
			
			// Predicates
			'.is_invertible()','.is_symmetric()','.is_hermitian()',
			'.is_positive_definite()','.is_diagonalizable()',
			'.is_nilpotent()','.is_diagonal()','.is_normal()',
			
			// Construction
			'.augment()','.stack()','.tensor_product()','.kronecker_product()',
			
			// Decompositions
			'.cholesky()','.LU()','.QR()','.SVD()',
			
			// Matrix functions
			'.exponential()','.exp()','.log()','.sqrt()','.powers()',
			
			// Element-wise operations
			'.apply_map()','.apply_morphism()','.change_ring()',
			
			// Access
			'.rows()','.columns()','.row()','.column()','.submatrix()',
			'.pivot_rows()','.pivots()','.nonpivots()',
			
			// Reduction
			'.gram_schmidt()','.LLL()','.BKZ()',
			
			// Output
			'.str()','.latex()','._latex_()','._repr_()','._ascii_art_()'
		],
		
		// Plotting and visualization
		plot: [
			'plot()','plot2d()','parametric_plot()','polar_plot()','implicit_plot()',
			'plot3d()','parametric_plot3d()','implicit_plot3d()',
			'contour_plot()','contour_plot3d()','region_plot()','density_plot()',
			'list_plot()','list_plot3d()','scatter_plot()','scatter3d()',
			'bar_chart()','histogram()','boxplot()','violin_plot()',
			'line()','line2d()','line3d()','polygon()','polygon2d()','polygon3d()',
			'circle()','ellipse()','hyperbola()','parabola()','arc()','sector()',
			'point()','point2d()','point3d()','points()','points2d()','points3d()',
			'text()','text2d()','text3d()','arrow()','arrow2d()','arrow3d()',
			'sphere()','cube()','tetrahedron()','octahedron()',
			'dodecahedron()','icosahedron()',
			'torus()','cylinder()','cone()',
			'revolution_plot3d()','spherical_plot3d()','cylindrical_plot3d()',
			'vector_field()','plot_vector_field()','plot_vector_field3d()',
			'stream_plot()','slope_field()','direction_field()',
			'complex_plot()','complex_root_plot()','riemann_surface()',
			'animate()','show()','save()','export()',
			'graphics_array()','multi_graphics()',
			'Graphics','Graphics2d','Graphics3d','GraphicPrimitive',
			'rainbow()','Color','colormaps','hue()','rgbcolor()',
			'pointsize','thickness','rgbcolor','color','legend_label',
			'axes','axes_labels','frame','gridlines','ticks','tick_formatter',
			'xmin','xmax','ymin','ymax','zmin','zmax','aspect_ratio',
			'figsize','dpi','transparent','fontsize'
		],
		
		// Plot methods (dot notation)
		plot_methods: [
			'.show()','.save()','.export()','.axes()','.axes_labels()',
			'.set_aspect_ratio()','.set_axes_range()','.set_legend_options()',
			'.set_title()','.set_caption()','.set_figsize()',
			'.translate()','.scale()','.rotate()',
			'.aspect_ratio','.xmin','.xmax','.ymin','.ymax','.zmin','.zmax'
		],
		
		// Interactivity and interface
		interact: [
			'interact()','interact_manual()','interact_layout()',
			'slider()','range_slider()','discrete_slider()',
			'input_box()','input_grid()','color_selector()','colorpicker()',
			'selector()','dropdown()','radio_buttons()','button()','checkbox()',
			'text_control()','html_control()','latex_control()',
			'auto_update()','update()','continuous_update()',
			'pretty_print()','pretty_print_default()','show_default()',
			'latex()','view()','mathjax','MathJax','tachyon','tikz()',
			'sage_eval()','preparse()','load()','attach()','unload()','detach()',
			'data()','attach_spec()','load_attach_path()',
			'walltime()','cputime()','timeit()','time()','timing()',
			'html()','Math()','RawHtml()','SwfObject()','ThreeJS()',
			'sagenb','jupyter','notebook','cell','worksheet'
		],
		
		// Number theory and combinatorics
		nt_comb: [
			'ZZ','QQ','RR','CC','Integers()','Rationals()','Reals()','Complexes()',
			'Primes()','Mersenne()','Fibonacci()','Catalan()',
			'Mod()','mod()','IntegerModRing()','Zmod()',
			'QuadraticForm()','BinaryQF()','TernaryQF()',
			'EllipticCurve()','CremonaDatabase()','isogeny()','isogeny_class()',
			'ModularForms()','CuspForms()','EisensteinForms()',
			'DirichletGroup()','DirichletCharacter()',
			'AbelianGroup()','PermutationGroup()','SymmetricGroup()',
			'DihedralGroup()','AlternatingGroup()','CyclicGroup()',
			'DirectProduct()','SemidirectProduct()',
			'WeylGroup()','CoxeterGroup()','ReflectionGroup()',
			'Poset()','LatticePoset()','YoungLattice()','PartitionLattice()',
			'CombinatorialFreeModule()','SymmetricFunctions()',
			'Schur','e','h','p','m','s',
			'Partition()','Partitions()','Compositions()','Permutations()',
			'Tableau()','StandardTableaux()','SemistandardTableaux()',
			'YoungTableau()','YoungDiagram()','FerrersDiagram()',
			'CartanType()','RootSystem()','WeylCharacterRing()',
			'Crystals()','TensorProductOfCrystals()','HighestWeightCrystal()',
			'ClusterSeed()','ClusterAlgebra()','Quiver()'
		],
		
		// Statistics and probability
		stats: [
			'mean()','variance()','std()','standard_deviation()',
			'median()','mode()',
			'covariance()','correlation()','corrcoef()',
			'random()','randint()','choice()','sample()','shuffle()',
			'RealDistribution()','GeneralDiscreteDistribution()',
			'SphericalDistribution()',
			'Uniform()','Normal()','Exponential()','Gamma()','Beta()',
			'ChiSquared()','TDistribution()','FDistribution()',
			'LogNormal()','Weibull()','Pareto()',
			'binomial_distribution()','poisson_distribution()',
			'geometric_distribution()',
			'empirical_distribution()','discrete_distribution()',
			'fit_dist()','maximum_likelihood_estimate()','mle()',
			'hypothesis_test()','t_test()','chi_square_test()','ks_test()',
			'TimeSeries()','autoregressive_model()','arma()','arima()'
		],
		
		// Numerical and scientific computing
		numerical: [
			'find_root()','find_maximum_on_interval()','find_minimum_on_interval()',
			'numerical_integral()','numerical_diff()','numerical_approx()','n()','N()',
			'fast_callable()','fast_float()','numpy','scipy','mpmath',
			'ode_solver()','desolve()','desolve_rk4()','desolve_odeint()',
			'desolve_laplace()','desolve_system()','desolve_mintides()',
			'interpolate()','spline()','lagrange_polynomial()','newton_polynomial()',
			'fft()','ifft()','dct()','idct()','dst()','idst()',
			'wavelet()','wavelet_packet()','discrete_wavelet_transform()'
		],
		
		// Differential equations
		ode: [
			'desolve()','desolve_laplace()','desolve_system()',
			'desolve_rk4()','desolve_odeint()','desolve_mintides()',
			'ode_solver()','odefun()',
			'laplace()','inverse_laplace()','ilt()',
			'dsolve()','ode2()','ic1()','ic2()','bc2()',
			'function()','declare()','depends()','gradef()',
			'diffeq2de()','de2diffeq()',
			'DifferentialRing()','DifferentialField()',
			'characteristic_series()','differential_chains()'
		],
		
		// Geometry
		geometry: [
			'Point()','point()','Line()','line()','Segment()','segment()',
			'Ray()','ray()',
			'Circle()','circle()','Ellipse()','ellipse()',
			'Hyperbola()','hyperbola()','Parabola()','parabola()',
			'Arc()','arc()','Sector()','sector()',
			'Polygon()','polygon()','Triangle()','triangle()',
			'Polyhedron()','polyhedron()','Cone()','cone()',
			'Cylinder()','cylinder()','Sphere()','sphere()',
			'AffineSpace()','ProjectiveSpace()','EuclideanSpace()',
			'AffineGroup()','EuclideanGroup()','SimilarityGroup()',
			'translation()','rotation()','scaling()','reflection()',
			'convex_hull()','voronoi_diagram()','delaunay_triangulation()',
			'area()','perimeter()','volume()',
			'centroid()','circumcenter()','incenter()','orthocenter()',
			'is_convex()','is_collinear()','is_coplanar()',
			'is_parallel()','is_perpendicular()'
		],
		
		// Geometry methods (dot notation)
		geometry_methods: [
			'.area()','.perimeter()','.volume()',
			'.centroid()','.circumcenter()','.incenter()','.orthocenter()',
			'.is_convex()','.is_collinear()','.is_coplanar()',
			'.is_parallel()','.is_perpendicular()',
			'.intersection()','.distance()','.plot()','.show()'
		],
		
		// Graph theory
		graphs: [
			'Graph()','DiGraph()','MultiGraph()','MultiDiGraph()',
			'graphs','digraphs','graph_generators',
			'CompleteGraph()','CycleGraph()','PathGraph()','StarGraph()',
			'WheelGraph()','PetersenGraph()','HeawoodGraph()',
			'CubeGraph()','IcosahedralGraph()',
			'RandomGraph()','RandomTree()','RandomRegularGraph()',
			'graph()','subgraph()','induced_subgraph()',
			'union()','disjoint_union()','cartesian_product()',
			'vertices()','edges()','neighbors()',
			'degree()','in_degree()','out_degree()',
			'add_vertex()','add_edge()','delete_vertex()','delete_edge()',
			'is_connected()','is_planar()','is_bipartite()',
			'is_tree()','is_forest()',
			'connected_components()','strongly_connected_components()',
			'shortest_path()','all_shortest_paths()',
			'diameter()','radius()','center()',
			'chromatic_number()','chromatic_polynomial()','coloring()',
			'clique_number()','cliques()','independent_set()',
			'matching()','perfect_matching()','max_flow()','min_cut()',
			'spanning_tree()','min_spanning_tree()','kruskal()','prim()',
			'adjacency_matrix()','incidence_matrix()','laplacian_matrix()',
			'spectrum()','eigenvalues()','eigenvectors()',
			'layout()','plot()','show()','save()','export()',
			'graphviz','dot2tex'
		],
		
		// Graph methods (dot notation)
		graph_methods: [
			'.vertices()','.edges()','.neighbors()',
			'.degree()','.in_degree()','.out_degree()',
			'.add_vertex()','.add_edge()','.delete_vertex()','.delete_edge()',
			'.is_connected()','.is_planar()','.is_bipartite()',
			'.is_tree()','.is_forest()','.is_regular()','.is_eulerian()',
			'.connected_components()','.strongly_connected_components()',
			'.shortest_path()','.all_shortest_paths()',
			'.diameter()','.radius()','.center()','.periphery()',
			'.chromatic_number()','.chromatic_polynomial()','.coloring()',
			'.clique_number()','.cliques()','.cliques_maximal()',
			'.independent_set()','.matching()','.perfect_matching()',
			'.max_flow()','.min_cut()','.edge_cut()','.vertex_cut()',
			'.spanning_tree()','.min_spanning_tree()',
			'.kruskal()','.prim()','.boruvka()',
			'.adjacency_matrix()','.incidence_matrix()','.laplacian_matrix()',
			'.spectrum()','.eigenvalues()','.eigenvectors()',
			'.kirchhoff_matrix()','.weighted_adjacency_matrix()',
			'.layout()','.plot()','.show()','.save()','.export()',
			'.automorphism_group()','.is_isomorphic()','.is_subgraph()',
			'.complement()','.line_graph()','.to_directed()','.to_undirected()'
		],
		
		// String and I/O methods
		string_io: [
			'.str()','._repr_()','._latex_()','._ascii_art_()','._sage_input_()',
			'.save()','.load()','.export()','.write()','.read()',
			'.nbytes()','.memory_usage()'
		]
	};